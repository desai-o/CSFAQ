function formatAnonymousPost(post) {
  // Works for both mongoose docs (which have .toObject()) and plain SQLite objects
  const formatted = post.toObject ? post.toObject() : { ...post };

  // SQLite returns 1/0 for boolean, MongoDB returns true/false
  const isAnonymous = formatted.is_anonymous === true || formatted.is_anonymous === 1;

  if (isAnonymous) {
    delete formatted.author_id;
    delete formatted.real_name;
    delete formatted.username;
    delete formatted.avatar_url;

    // Inject generic placeholders
    formatted.author_name = "Anonymous User";
    formatted.username = "anonymous";
    formatted.author = "Anonymous User";
    formatted.avatar_url = "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";
  }

  return formatted;
}

module.exports = {
  formatAnonymousPost
};
