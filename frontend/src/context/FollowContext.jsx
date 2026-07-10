import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import {
  followResource as apiFollow,
  unfollowResource as apiUnfollow,
  muteFollow as apiMute,
  fetchMyFollows as apiFetchMyFollows
} from "../api/faqApi";
import { useAuth } from "./AuthContext";

const FollowContext = createContext(null);

function keyFor(type, id) {
  return `${type}::${String(id)}`;
}

export function FollowProvider({ children }) {
  const { user } = useAuth();
  // Map<string, { id, followableType, followableId, isMuted }>
  const [follows, setFollows] = useState(() => new Map());
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setFollows(new Map());
      setLoaded(true);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetchMyFollows();
      const list = res?.data || [];
      const next = new Map();
      for (const f of list) {
        const id = f.id || f._id;
        const type = f.followableType || f.followable_type;
        const targetId = f.followableId || f.followable_id;
        if (!id || !type || !targetId) continue;
        const mute = Boolean(f.isMuted ?? f.is_muted);
        next.set(keyFor(type, targetId), {
          id: String(id),
          followableType: type,
          followableId: String(targetId),
          isMuted: mute
        });
      }
      setFollows(next);
    } catch (err) {
      console.warn("Failed to load follows:", err?.message || err);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    setLoaded(false);
    refresh();
  }, [refresh]);

  const isFollowing = useCallback(
    (type, id) => follows.has(keyFor(type, id)),
    [follows]
  );

  const getFollowRecord = useCallback(
    (type, id) => follows.get(keyFor(type, id)) || null,
    [follows]
  );

  const follow = useCallback(async (type, id) => {
    if (!user) {
      throw new Error("Please log in to follow");
    }
    // Optimistic add so the UI reflects the change immediately,
    // before the network call resolves.
    const k = keyFor(type, id);
    let pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let alreadyExisted = false;
    setFollows((prev) => {
      const next = new Map(prev);
      alreadyExisted = next.has(k);
      next.set(k, {
        id: pendingId,
        followableType: type,
        followableId: String(id),
        isMuted: false
      });
      return next;
    });
    try {
      const res = await apiFollow(type, id);
      const raw = res?.data || {};
      const followId = raw._id || raw.id;
      const targetId = raw.followableId || raw.followable_id || id;
      const followType = raw.followableType || raw.followable_type || type;
      // Replace the pending record with the real server-issued one.
      setFollows((prev) => {
        const next = new Map(prev);
        if (followId) pendingId = String(followId);
        next.set(keyFor(followType, targetId), {
          id: String(followId || pendingId),
          followableType: followType,
          followableId: String(targetId),
          isMuted: false
        });
        return next;
      });
      return res;
    } catch (err) {
      // If backend says "already following", reconcile by refreshing.
      if (err?.status === 409 || /already/i.test(err?.message || "")) {
        if (!alreadyExisted) await refresh();
        return;
      }
      // Other failures: roll back the optimistic insert.
      setFollows((prev) => {
        const next = new Map(prev);
        if (!alreadyExisted) {
          next.delete(k);
        } else {
          // Re-add the original record (best effort: leave as-is if unknown).
          next.set(k, prev.get(k));
        }
        return next;
      });
      throw err;
    }
  }, [user, refresh]);

  const unfollow = useCallback(async (type, id) => {
    const existing = follows.get(keyFor(type, id));
    // Optimistic remove
    setFollows((prev) => {
      const next = new Map(prev);
      next.delete(keyFor(type, id));
      return next;
    });
    try {
      if (existing?.id) {
        await apiUnfollow(existing.id);
      }
    } catch (err) {
      console.warn("Unfollow failed; restored state", err?.message || err);
      // Roll back optimistic delete by refreshing from server
      await refresh();
      throw err;
    }
  }, [follows, refresh]);

  const toggleMute = useCallback(async (type, id) => {
    const existing = follows.get(keyFor(type, id));
    if (!existing) return;
    const nextMuted = !existing.isMuted;
    setFollows((prev) => {
      const next = new Map(prev);
      next.set(keyFor(type, id), { ...existing, isMuted: nextMuted });
      return next;
    });
    try {
      await apiMute(existing.id, nextMuted);
    } catch (err) {
      // Roll back
      setFollows((prev) => {
        const next = new Map(prev);
        next.set(keyFor(type, id), existing);
        return next;
      });
      throw err;
    }
  }, [follows]);

  // Helpers for subscriptions page
  const followedTags = useMemo(() => {
    const out = [];
    for (const f of follows.values()) {
      if (f.followableType === "tag") out.push(f.followableId);
    }
    return out;
  }, [follows]);

  const followedQuestionIds = useMemo(() => {
    const out = [];
    for (const f of follows.values()) {
      if (f.followableType === "question") out.push(f.followableId);
    }
    return out;
  }, [follows]);

  const value = {
    follows,         // Map keyed by `type::id`
    followedTags,    // string[]
    followedQuestionIds, // string[]
    loaded,
    loading,
    refresh,
    isFollowing,
    getFollowRecord,
    follow,
    unfollow,
    toggleMute
  };

  return <FollowContext.Provider value={value}>{children}</FollowContext.Provider>;
}

export function useFollow() {
  const ctx = useContext(FollowContext);
  if (!ctx) {
    throw new Error("useFollow must be used inside FollowProvider");
  }
  return ctx;
}
