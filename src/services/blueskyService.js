// Bluesky Service
const { BskyAgent } = require('@atproto/api');
const fetch = require('node-fetch');
const FormData = require('form-data');

// Add required globals for @atproto/api
global.fetch = fetch;
global.Headers = fetch.Headers;
global.Request = fetch.Request;
global.Response = fetch.Response;
global.FormData = FormData;
global.Blob = Buffer; // Some APIs might need Blob

/**
 * Logs in to Bluesky with the provided handle and password
 * @param {string} handle - Bluesky handle
 * @param {string} password - Bluesky password
 * @returns {Promise<Object>} Login result
 */
exports.login = async (handle, password) => {
   try {
      if (typeof handle !== 'string' || typeof password !== 'string') {
         throw new Error('Handle and password must be strings');
      }

      if (!handle || !password) {
         throw new Error('Handle and password are required');
      }

      const agent = new BskyAgent({ service: 'https://bsky.social' });
      const loginResult = await agent.login({ identifier: handle, password });

      if (!agent.session?.did || !agent.session?.accessJwt || !agent.session?.refreshJwt) {
         throw new Error('Login successful but session data is incomplete');
      }

      return {
         accessJwt: agent.session.accessJwt,
         refreshJwt: agent.session.refreshJwt,
         did: agent.session.did,
      };
   } catch (error) {
      console.error('[Bluesky] Login failed:', error.message);
      throw error;
   }
};

/**
 * Creates a post on Bluesky with optional image and text
 * @param {string} accessJwt - Bluesky access token
 * @param {string} did - User's DID
 * @param {string} text - Optional post text content
 * @param {Object} [imageData] - Optional image data
 * @param {Buffer} imageData.data - Image buffer
 * @param {string} imageData.type - Image MIME type
 * @param {string} imageData.name - Image filename
 * @returns {Promise<Object>} Post creation result
 */
exports.createPost = async (accessJwt, did, text = '', imageData = null) => {
   try {
      if (!accessJwt || !did) {
         throw new Error('Access JWT and DID are required');
      }

      // Require at least text or image
      if (!text && !imageData) {
         throw new Error('Either text or image is required for a post');
      }

      const agent = new BskyAgent({ service: 'https://bsky.social' });
      await agent.resumeSession({ accessJwt, refreshJwt: null, did });

      // Upload image if provided
      let uploadedBlob = null;
      if (imageData) {
         if (!Buffer.isBuffer(imageData.data)) {
            throw new Error('imageData.data must be a Buffer');
         }
         if (!imageData.type || typeof imageData.type !== 'string') {
            throw new Error('Invalid or missing MIME type for imageData');
         }

         // Skip GIF files
         if (imageData.type === 'image/gif') {
            throw new Error('GIF files are temporarily not supported');
         }

         // Handle regular images
         const uint8Array = new Uint8Array(imageData.data);
         const { data } = await agent.uploadBlob(uint8Array, {
            mimeType: imageData.type,
            encoding: 'image/jpeg'
         });

         if (!data?.blob) {
            throw new Error('Image upload failed: No blob reference in response');
         }
         uploadedBlob = data.blob;
      }

      // Create post record
      const postRecord = {
         $type: 'app.bsky.feed.post',
         text: text,
         createdAt: new Date().toISOString()
      };

      // Add image embed if present
      if (uploadedBlob) {
         postRecord.embed = {
            $type: 'app.bsky.embed.images',
            images: [{
               alt: imageData.name || 'Image',
               image: uploadedBlob
            }]
         };
      }

      const response = await agent.post(postRecord);
      return {
         success: true,
         uri: response.uri,
         cid: response.cid
      };
   } catch (error) {
      console.error('[Bluesky] Post creation failed:', error.message);
      throw error;
   }
};

/**
 * Retrieves posts from Bluesky for the provided user
 * @param {string} accessJwt - Bluesky access token
 * @param {string} did - User's DID
 * @returns {Promise<Object>} Posts retrieval result
 */
exports.getPosts = async (accessJwt, did) => {
   try {
      if (!accessJwt || !did) {
         throw new Error('Access JWT and DID are required');
      }

      const agent = new BskyAgent({ service: 'https://bsky.social' });
      await agent.resumeSession({ accessJwt, refreshJwt: null, did });

      const response = await agent.getAuthorFeed({ actor: did, limit: 50 });
      const posts = await Promise.all(response.data.feed.map(async (item) => {
         const post = {
            text: item.post.record.text,
            uri: item.post.uri,
            cid: item.post.cid,
            createdAt: item.post.record.createdAt,
            likeCount: item.post.likeCount || 0,
            repostCount: item.post.repostCount || 0,
            media: []
         };

         // Handle embedded images
         if (item.post.embed?.images?.length > 0) {
            post.media = item.post.embed.images.map(img => ({
               type: 'image',
               alt: img.alt,
               url: img.fullsize,
               thumb: img.thumb
            }));
         }
         // Handle embedded external media
         else if (item.post.embed?.external) {
            const external = item.post.embed.external;

            // Check if it's a GIF (either by MIME type or URL)
            const isGif = external.mime === 'image/gif' ||
               external.uri?.toLowerCase().endsWith('.gif') ||
               external.uri?.includes('giphy.com') ||
               external.uri?.includes('tenor.com');

            if (isGif) {
               post.media.push({
                  type: 'gif',
                  url: external.uri,
                  thumb: external.thumb,
                  title: external.title
               });
            }
            // Handle videos
            else if (external.mime?.startsWith('video/') ||
               external.uri?.match(/\.(mp4|webm|mov)$/i)) {
               post.media.push({
                  type: 'video',
                  url: external.uri,
                  thumb: external.thumb,
                  title: external.title
               });
            }
            // Handle other external images
            else if (external.mime?.startsWith('image/') ||
               external.uri?.match(/\.(jpg|jpeg|png|webp)$/i)) {
               post.media.push({
                  type: 'image',
                  url: external.uri,
                  thumb: external.thumb || external.uri,
                  alt: external.title || 'External image'
               });
            }
         }

         return post;
      }));

      return { success: true, posts };
   } catch (error) {
      console.error('[Bluesky] Posts retrieval failed:', error.message);
      throw error;
   }
};

/**
 * Deletes a post on Bluesky
 * @param {string} accessJwt - Bluesky access token
 * @param {string} did - User's DID
 * @param {string} uri - Post URI
 * @returns {Promise<Object>} Post deletion result
 */
exports.deletePost = async (accessJwt, did, uri) => {
   try {
      if (!accessJwt || !did || !uri) {
         throw new Error('Access JWT, DID, and URI are required');
      }

      const agent = new BskyAgent({ service: 'https://bsky.social' });
      await agent.resumeSession({ accessJwt, refreshJwt: null, did });

      await agent.deletePost(uri);
      return { success: true };
   } catch (error) {
      console.error('[Bluesky] Post deletion failed:', error.message);
      throw error;
   }
};

/**
 * Refresh a Bluesky session using refresh token
 * @param {string} refreshJwt - The refresh token
 * @returns {Promise<{accessJwt: string, refreshJwt: string}>} New session tokens
 */
exports.refreshSession = async (refreshJwt) => {
   try {
      const agent = new BskyAgent({ service: 'https://bsky.social' });
      await agent.resumeSession({ refreshJwt });

      return {
         accessJwt: agent.session.accessJwt,
         refreshJwt: agent.session.refreshJwt
      };
   } catch (error) {
      console.error('[Bluesky] Session refresh error:', error);
      throw new Error('Failed to refresh session');
   }
};
