import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFollow } from "../context/FollowContext";
import { useAuth } from "../context/AuthContext";

/**
 * A hashtag chip that can be followed / unfollowed simply by clicking it.
 *
 * - The whole tag acts as a follow toggle. When the user is not logged in
 *   they are redirected to the login page.
 * - A tiny ice-blue "online status" dot appears next to the tag once it
 *   is followed, so users get a clear visual hint without any extra text.
 * - State is owned by FollowContext so it survives navigation/reloads and
 *   stays in sync everywhere this component is rendered.
 *
 * Props:
 *   - tag:    The tag string, e.g. "react" or "#react" (the leading "#"
 *             is stripped internally).
 *   - size:   "sm" | "md" (default "md") for visual sizing.
 *   - onClickTag: optional callback fired with the normalized tag after a
 *             click. If provided, follow toggling still happens unless you
 *             call `e.preventDefault()` inside the handler. Used in places
 *             where the tag click navigates to a listing page.
 *   - variant: "chip" | "inline" for visual style.
 */
export default function Hashtag({
  tag,
  size = "md",
  onClickTag,
  variant = "chip"
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFollowing, follow, unfollow } = useFollow();
  const [busy, setBusy] = useState(false);

  const normalized = String(tag || "").replace(/^#/, "").trim().toLowerCase();
  if (!normalized) return null;

  const following = isFollowing("tag", normalized);

  const handleClick = async (e) => {
    // Run the optional custom handler first (e.g., navigate to tag page).
    let customHandled = false;
    if (onClickTag) {
      // Let consumers opt out of the follow toggle by calling
      // preventDefault on the event.
      onClickTag(normalized, e);
      customHandled = e?.defaultPrevented;
    }

    // If a consumer already handled the click (e.g., navigated away),
    // don't double-toggle the follow state.
    if (customHandled) return;

    // Otherwise the whole tag acts as the follow toggle.
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate("/login");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      if (following) {
        await unfollow("tag", normalized);
      } else {
        await follow("tag", normalized);
      }
    } catch (err) {
      console.warn("Hashtag follow toggle failed:", err?.message || err);
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      handleClick(e);
    }
  };

  const sizeClass = size === "sm" ? "tag-sm" : "tag-md";
  const variantClass = variant === "inline" ? "tag-inline" : "tag-chip";

  const stateClass = busy
    ? "busy"
    : following
    ? "following"
    : "not-following";

  const label = following
    ? `Following #${normalized}. Click to unfollow.`
    : busy
    ? `Working on it\u2026`
    : `Follow #${normalized}. Click to follow.`;

  return (
    <span
      className={`hashtag ${sizeClass} ${variantClass} ${stateClass}`}
      role="button"
      tabIndex={busy ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-pressed={following}
      aria-busy={busy}
      title={label}
      aria-label={label}
    >
      <span className="tag-text">#{normalized}</span>
      {following && (
        <span className="tag-follow-dot" aria-hidden="true" />
      )}
    </span>
  );
}
