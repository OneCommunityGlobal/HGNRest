/**
 * @typedef {Object} NpfPostDTO
 * @property {string} text - The main text content of the post
 * @property {string[]} tags - Optional array of tags
 * @property {string} state - 'published', 'draft', 'queue', etc.
 * @property {boolean} isPrivate - Whether the post is private
 * @property {string} [slug] - Optional custom slug for the post
 */

/**
 * Builds a DTO to send a Tumblr NPF post
 */
class NpfPostDto {
  /**
   * @param {Object} params
   * @param {string} params.text
   * @param {string[]} [params.tags]
   * @param {string} [params.state]
   * @param {boolean} [params.isPrivate]
   * @param {string} [params.slug]
   */
  constructor({ text, tags = [], state = 'published', isPrivate = false, slug }) {
    if (!text || typeof text !== 'string') {
      throw new Error('Text is required for NPF post');
    }

    this.content = [{ type: 'text', text }];
    this.tags = tags;
    this.state = state;
    this.is_private = isPrivate;
    if (slug) this.slug = slug;
  }

  /**
   * Returns plain object ready to send to Tumblr API
   * @returns {Object}
   */
  toJSON() {
    const data = {
      content: this.content,
      state: this.state,
      tags: this.tags,
      is_private: this.is_private,
    };
    if (this.slug) data.slug = this.slug;
    return data;
  }
}

module.exports = NpfPostDto;
