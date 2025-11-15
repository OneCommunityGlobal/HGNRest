const axios = require('axios');
const RedditToken = require('../models/RedditToken');
const RedditPost = require('../models/RedditPost');

const redditPostController = () => {
  const getAccessToken = async () => {
    const token = await RedditToken.find({});

    if (!token) throw new Error('No reddit token found in database');

    const createdAt = new Date(token[0].created_at);
    const expiresIn = token[0].expires_in;
    const expiryTime = createdAt.getTime() + expiresIn * 1000;

    if (Date.now() <= expiryTime && token.access_token) {
      return token;
    }

    // refresh
    const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET } = process.env;
    const auth = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
    const refreshTokenUrl = 'https://www.reddit.com/api/v1/access_token';

    const res = await axios.post(
      refreshTokenUrl,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token[0].refresh_token,
      }),
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    if (!res.data || !res.data.access_token) {
      throw new Error('Failed to refresh reddit access token');
    }

    const updated = await RedditToken.findByIdAndUpdate(token[0]._id, {
      access_token: res.data.access_token,
      refresh_token: res.data.refresh_token,
      expires_in: res.data.expires_in,
      scope: res.data.scope,
      created_at: new Date(Date.now()),
    });

    return updated;
  };

  const submitRedditPostBulk = async (data, accessToken) => {
    try {
      const { title, content, url, subreddit, link } = data;
      if (!title || !subreddit) {
        throw new Error('Title and subreddit are required');
      }
      const postData = {
        title,
        sr: subreddit,
        api_type: 'json',
      };

      if (url !== '') {
        postData.url = link;
        postData.kind = 'link';
      } else if (content !== '') {
        postData.kind = 'self';
        postData.text = content;
      }

      const response = await axios.post(
        'https://oauth.reddit.com/api/submit',
        new URLSearchParams(postData),
        {
          headers: {
            Authorization: `Bearer  ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'HGN Auto Poster/1.0 by HGN',
          },
        },
      );

      const redditError = response?.data?.json?.errors;
      const redditData = response?.data?.json?.data;

      if (redditError && redditError.length > 0) {
        return { success: false, details: redditError };
      }

      return { success: true, details: redditData };
    } catch (error) {
      console.error('submitRedditPostTemp error:', error);
      throw error;
    }
  };

  const redditLogin = async (req, res) => {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Missing reddit authorization code',
      });
    }

    const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_REDIRECT_URL } = process.env;
    const auth = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64');
    try {
      const response = await axios.post(
        'https://www.reddit.com/api/v1/access_token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDDIT_REDIRECT_URL,
        }),
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      if (response.data) {
        await RedditToken.create({
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token,
          expires_in: response.data.expires_in,
          scope: response.data.scope,
        });

        return res.status(200).json({
          success: true,
          access_token: response.data.access_token,
          refresh_token: response.data.refresh_token,
          expires_in: response.data.expires_in,
          scope: response.data.scope,
          message: 'Reddit access Token received',
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Failed to retrive access token from reddit',
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve access token from reddit',
        reddit_error: error.response?.data,
      });
    }
  };

  const isRedditTokenExists = async (req, res) => {
    try {
      const token = await RedditToken.findOne({});
      if (!token) {
        return res.status(200).json({
          success: true,
          exists: false,
          message: 'No Reddit token found in database',
        });
      }

      // Reddit token found in DB and check token validity
      const createdAt = new Date(token.created_at);
      const expiryTime = createdAt.getTime() + (token.expires_in || 0) * 1000;
      const isExpired = Date.now() > expiryTime;

      if (isExpired) {
        try {
          // update by exchanging refresh token
          const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET } = process.env;
          const auth = Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString(
            'base64',
          );

          const refreshTokenUrl = 'https://www.reddit.com/api/v1/access_token';

          const response = await axios.post(
            refreshTokenUrl,
            new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: token.refresh_token,
            }),
            {
              headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            },
          );

          if (!response.data?.access_token) {
            throw new Error('Invalid response from Reddit refresh token endpoint');
          }

          const updated = await RedditToken.findByIdAndUpdate(
            token._id,
            {
              access_token: response.data.access_token,
              refresh_token: response.data.refresh_token,
              expires_in: response.data.expires_in,
              scope: response.data.scope,
              created_at: new Date(Date.now()),
            },
            { new: true },
          );

          return res.status(200).json({
            success: true,
            exists: true,
            message: 'Token refreshed successfully',
            token: updated.access_token,
          });
        } catch (error) {
          console.error('Token refresh failed:', error);
          return res.status(200).json({
            success: true,
            exists: true,
            message: error.message || 'Token expired and refresh failed',
          });
        }
      }

      // Token exists and is valid
      return res.status(200).json({
        success: true,
        exists: true,
        message: 'Reddit authentication token is valid and active',
        token: token.access_token,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        success: false,
        exists: false,
        message: error.message || 'Unable to fetch Reddit token',
      });
    }
  };

  const submitRedditPost = async (req, res) => {
    try {
      const redditToken = await RedditToken.find({});

      const { title, content, subreddit, postType, link } = req.body;

      const postData = {
        title,
        sr: subreddit,
        api_type: 'json',
      };

      if (redditToken.length > 0) {
        const accessToken = redditToken[0].access_token;

        if (postType === 'link') {
          postData.url = link;
          postData.kind = 'link';
        } else {
          postData.kind = 'self';
          postData.text = content;
        }

        const response = await axios.post(
          'https://oauth.reddit.com/api/submit',
          new URLSearchParams(postData),
          {
            headers: {
              Authorization: `Bearer  ${accessToken}`,
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'HGN Auto Poster/1.0 by HGN',
            },
          },
        );

        const redditError = response?.data?.json?.errors;
        const redditData = response?.data?.json?.data;

        if (redditError && redditError.length > 0) {
          return res.status(400).json({
            status: false,
            message: 'Unable to submit reddit post',
            errors: redditError,
          });
        }

        return res.status(201).json({
          status: true,
          message: 'Successfully submit reddit post',
          redditData,
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Failed to retrive access token from reddit',
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        status: false,
        message: error.message || 'Unable to submit post to reddit through autoposter',
      });
    }
  };

  const scheduleRedditPost = async (req, res) => {
    try {
      const { title, subreddit, content, postType, link, scheduledAt } = req.body;
      if (!title || !subreddit || !scheduledAt) {
        return res.status(400).json({
          success: false,
          message: 'title, subreddit and schedule date is required',
        });
      }

      // parse schedule time
      const scheduledDate = new Date(scheduledAt);
      if (Number.isNaN(scheduledDate.getTime())) {
        return res.status(400).json({
          success: false,
          messgae: 'Invalid schedule time',
        });
      }

      if (scheduledDate.getTime() <= Date.now()) {
        return res.status(400).json({
          success: false,
          message: 'schedule at must be a future date/time',
        });
      }

      const postData = {
        title,
        subreddit,
        content: content || '',
        url: postType === 'link' ? link || '' : '',
        is_posted: false,
        scheduled_at: scheduledDate,
      };

      const created = await RedditPost.create(postData);

      return res.status(201).json({
        success: true,
        message: 'Post scheduled successfully',
        post: created,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to schedule post',
        error: error.response?.data || null,
      });
    }
  };

  const listRedditPost = async (req, res) => {
    try {
      const { status } = req.query;

      const query = {};
      if (status === 'scheduled') query.is_posted = false;
      else if (status === 'submitted') query.is_posted = true;

      const posts = await RedditPost.find(query).select('title scheduled_at');

      return res.status(200).json({
        success: true,
        posts,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch scheduled reddit posts',
        error: error.response?.data || null,
      });
    }
  };

  const deleteRedditPost = async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Post id is required',
        });
      }

      const deleted = await RedditPost.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(400).json({
          success: false,
          message: 'Post not found',
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Post deleted',
        post: deleted,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete post',
      });
    }
  };

  const getRedditPostById = async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          status: false,
          message: 'Post id is required',
        });
      }

      const post = await RedditPost.findById(id);
      if (!post) {
        return res.status(204).json({
          status: false,
          message: `Post not found for id ${id}`,
        });
      }
      return res.status(200).json({ success: true, post });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve post',
      });
    }
  };

  const updateScheduledPost = async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ success: false, message: 'Post id is required' });
      }

      // Map scheduledAt to scheduled_at if it exists in request body
      if (req.body.scheduledAt) {
        req.body.scheduled_at = req.body.scheduledAt;
        delete req.body.scheduledAt; // remove original field
      }

      const allowed = ['title', 'subreddit', 'content', 'url', 'is_posted', 'scheduled_at'];
      const updates = {};
      allowed.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(req.body, key)) updates[key] = req.body[key];
      });

      if (updates.scheduled_at) {
        const d = new Date(updates.scheduled_at);
        if (Number.isNaN(d.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid scheduled_at date' });
        }
        updates.scheduled_at = d;
      }
      updates.is_posted = false;

      const updated = await RedditPost.findByIdAndUpdate(id, updates);

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Post not found to update ',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Scheduled post updated successfully',
      });
    } catch (error) {
      console.log(error);
      res.status(500).send({
        success: false,
        message: error.message || 'Something went wrong while updating post',
      });
    }
  };

  const submitScheduledPosts = async (req, res) => {
    try {
      const posts = await RedditPost.find({ is_posted: false });

      if (posts.length === 0) {
        return res.status(400).json({
          success: false,
          total: 0,
          message: 'No reddit posts found to publish',
        });
      }

      // get token
      const validToken = await getAccessToken();
      const results = [];
      posts.forEach((post, index) => {
        setTimeout(async () => {
          try {
            const redditData = await submitRedditPostBulk(post, validToken.access_token);

            if (redditData.success) {
              const updated = await RedditPost.findByIdAndUpdate(post._id, { is_posted: false });
              results.push({
                id: post._id,
                status: updated ? 'posted & updated' : 'not updated',
                details: redditData.details,
              });
            } else {
              results.push({ id: post._id, status: 'error', details: redditData.details });
            }
          } catch (error) {
            results.push({ id: post._id, status: 'error', error: error.message });
          }
        }, index * 1000);
      });

      return res.status(200).json({
        success: true,
        total: posts.length,
        posts,
        token: validToken.access_token,
        results,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message || 'Unable to submit reddit scheduled posts',
      });
    }
  };

  return {
    redditLogin,
    isRedditTokenExists,
    submitRedditPost,
    scheduleRedditPost,
    listRedditPost,
    deleteRedditPost,
    getRedditPostById,
    updateScheduledPost,
    submitScheduledPosts,
  };
};

module.exports = redditPostController;
