function isAdmin(user) {
  return user && user.role === "admin";
}

function isModeratorOrAdmin(user) {
  return user && ["moderator", "admin"].includes(user.role);
}

function ownsResource(user, resource) {
  if (!user || !resource) return false;

  const resourceUserId =
    resource.userId ||
    resource.user_id ||
    resource.authorId ||
    resource.author_id;

  return String(resourceUserId) === String(user.id);
}

function canDeleteResource(user, resource) {
  return isAdmin(user) || ownsResource(user, resource);
}

module.exports = {
  isAdmin,
  isModeratorOrAdmin,
  ownsResource,
  canDeleteResource
};
