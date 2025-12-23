const tumblrService = require('../../services/tumblrService');
const { toTumblrPostDTO } = require('../../utilities/dtos/tumblrPostDTO');
const NpfPostDto = require('../../utilities/dtos/NpfPostDto');

const tumblrController = function () {
  // Get all posts from our blog
  const getAllPosts = async (req, res) => {
    try {
      const response = await tumblrService.client.blogPosts(tumblrService.blogId);

      const postDTOs = Array.isArray(response.posts) ? response.posts.map(toTumblrPostDTO) : [];

      res.status(200).json({
        posts: postDTOs,
        count: postDTOs.length,
      });
    } catch (error) {
      // console.error('Tumblr fetch error:', error);
      res.status(500).json({
        error: 'Failed to fetch Tumblr posts',
      });
    }
  };

  // Post new content to a blog
  const postToBlog = async (req, res) => {
    const { text, tags } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required.' });
    }

    try {
      const npfPost = new NpfPostDto({ text, tags });
      const response = await tumblrService.client.createPost(
        tumblrService.blogId,
        npfPost.toJSON(),
      );

      res.status(201).json(toTumblrPostDTO(response));
    } catch (error) {
      // console.error('Tumblr NPF error:', error);
      res.status(500).json({ error: error.message });
    }
  };

  // Delete a post from a blog
  const deletePost = async (req, res) => {
    const { postId } = req.params;
    try {
      // console.log('Deleting post:', tumblrService.blogId, postId);
      const response = await tumblrService.client.deletePost(tumblrService.blogId, postId);
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Get profile information
  const getProfileInfo = async (req, res) => {
    const { blogIdentifier } = req.params;

    try {
      const response = await tumblrService.client.blogInfo(blogIdentifier);
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // TODO: Edit Post

  return {
    getAllPosts,
    postToBlog,
    deletePost,
    getProfileInfo,
  };
};

module.exports = tumblrController();
