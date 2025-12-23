/**
 * @typedef {Object} TumblrPostDTO
 * @property {number} id
 * @property {string} type
 * @property {string|null} title
 * @property {string|null} content
 * @property {string[]} tags
 * @property {string} blogName
 * @property {string} date
 * @property {number} notes
 * @property {string} url
 */

/**
 * Maps a raw Tumblr API post into a TumblrPostDTO
 * DTOs are constructed at the controller boundary only
 *
 * @param {any} post
 * @returns {TumblrPostDTO}
 */
const toTumblrPostDTO = (post) => ({
  id: post.id,
  type: post.type,
  title: post.title ?? null,

  // Normalize different post types into one field
  content: post.body || post.caption || post.summary || null,

  tags: Array.isArray(post.tags) ? post.tags : [],
  blogName: post.blog_name,
  date: post.date,
  notes: post.note_count ?? 0,
  url: post.post_url,
});

module.exports = {
  toTumblrPostDTO,
};
