// Bluesky Controller

const blueskyService = require('../services/blueskyService');

// Handles Bluesky connection
exports.connect = async (req, res) => {
   try {
      const { handle, password } = req.body;
      if (!handle || !password) {
         return res.status(400).json({
            success: false,
            error: 'Handle and password are required'
         });
      }

      const session = await blueskyService.login(handle, password);
      req.session.bluesky = {
         accessJwt: session.accessJwt,
         refreshJwt: session.refreshJwt,
         did: session.did,
         handle: handle,
         loginTime: new Date().toISOString()
      };

      req.session.save((err) => {
         if (err) {
            return res.status(500).json({
               success: false,
               error: 'Failed to save session'
            });
         }

         return res.json({
            success: true,
            message: 'Successfully connected to Bluesky',
            did: session.did
         });
      });
   } catch (error) {
      return res.status(401).json({
         success: false,
         error: error.message || 'Failed to connect to Bluesky'
      });
   }
};

// Handles Bluesky disconnection
exports.disconnect = async (req, res) => {
   try {
      if (req.session) {
         req.session.destroy((err) => {
            if (err) {
               return res.status(500).json({
                  success: false,
                  error: 'Failed to clear session'
               });
            }

            return res.json({
               success: true,
               message: 'Successfully disconnected from Bluesky'
            });
         });
      } else {
         return res.json({
            success: true,
            message: 'Already disconnected'
         });
      }
   } catch (error) {
      return res.status(500).json({
         success: false,
         error: error.message || 'Failed to disconnect'
      });
   }
};

// Handles post creation with optional image
exports.createPost = async (req, res) => {
   try {
      const { text } = req.body;

      // Validate session
      if (!req.session?.bluesky?.accessJwt || !req.session?.bluesky?.did) {
         return res.status(401).json({
            success: false,
            error: 'Not authenticated with Bluesky'
         });
      }

      // Validate that either text or image is present
      if (!text?.trim() && !req.file?.buffer) {
         return res.status(400).json({
            success: false,
            error: 'Either text or image is required for a post'
         });
      }

      // Prepare image data if present
      let imageData = null;
      if (req.file?.buffer) {
         imageData = {
            data: req.file.buffer,
            type: req.file.mimetype,
            name: req.file.originalname
         };
      }

      // Create post
      const result = await blueskyService.createPost(
         req.session.bluesky.accessJwt,
         req.session.bluesky.did,
         text?.trim() || '', // Empty string if no text
         imageData
      );

      return res.json({
         success: true,
         ...result
      });
   } catch (error) {
      return res.status(500).json({
         success: false,
         error: error.message || 'Failed to create post'
      });
   }
};

// Retrieves posts for the logged-in user
exports.getPosts = async (req, res) => {
   try {
      if (!req.session?.bluesky?.accessJwt || !req.session?.bluesky?.did) {
         return res.status(401).json({
            success: false,
            error: 'Not authenticated with Bluesky'
         });
      }

      const result = await blueskyService.getPosts(
         req.session.bluesky.accessJwt,
         req.session.bluesky.did
      );

      return res.json({
         success: true,
         ...result
      });
   } catch (error) {
      return res.status(500).json({
         success: false,
         error: error.message || 'Failed to get posts'
      });
   }
};

// Deletes a post
exports.deletePost = async (req, res) => {
   try {
      const { uri } = req.params;

      if (!req.session?.bluesky?.accessJwt || !req.session?.bluesky?.did) {
         return res.status(401).json({
            success: false,
            error: 'Not authenticated with Bluesky'
         });
      }

      if (!uri) {
         return res.status(400).json({
            success: false,
            error: 'Post URI is required'
         });
      }

      await blueskyService.deletePost(
         req.session.bluesky.accessJwt,
         req.session.bluesky.did,
         uri
      );

      return res.json({
         success: true,
         message: 'Post deleted successfully'
      });
   } catch (error) {
      return res.status(500).json({
         success: false,
         error: error.message || 'Failed to delete post'
      });
   }
};

// Check session status
exports.checkSession = async (req, res) => {
   try {
      if (!req.session.bluesky || !req.session.bluesky.accessJwt) {
         return res.json({
            success: true,
            isConnected: false
         });
      }

      // Check if session needs refresh (older than 1 hour)
      const loginTime = new Date(req.session.bluesky.loginTime);
      const now = new Date();
      const hoursSinceLogin = (now - loginTime) / (1000 * 60 * 60);

      if (hoursSinceLogin >= 1) {
         // Try to refresh session
         try {
            const refreshedSession = await blueskyService.refreshSession(
               req.session.bluesky.refreshJwt
            );

            req.session.bluesky = {
               ...req.session.bluesky,
               accessJwt: refreshedSession.accessJwt,
               refreshJwt: refreshedSession.refreshJwt,
               loginTime: now.toISOString()
            };

            await new Promise((resolve, reject) => {
               req.session.save((err) => {
                  if (err) reject(err);
                  else resolve();
               });
            });
         } catch (error) {
            // If refresh fails, consider session expired
            return res.json({
               success: true,
               isConnected: false
            });
         }
      }

      return res.json({
         success: true,
         isConnected: true,
         handle: req.session.bluesky.handle
      });
   } catch (error) {
      return res.status(500).json({
         success: false,
         error: error.message || 'Failed to check session'
      });
   }
};
