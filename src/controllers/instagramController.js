const path = require('path');
const crypto = require('crypto');
const schedule = require('node-schedule');
const axios = require('axios');
const FormData = require('form-data');
const InstagramScheduledPost = require('../models/instagramPost');


require ('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const imgurClientId = process.env.REACT_APP_IMGUR_CLIENT_ID;
const imgurClientSecret = process.env.REACT_APP_IMGUR_CLIENT_SECRET;
const imgurRefreshToken = process.env.REACT_APP_IMGUR_REFRESH_TOKEN;

const instagramClientId = process.env.REACT_APP_INSTAGRAM_CLIENT_ID;
const instagramClientSecret = process.env.REACT_APP_INSTAGRAM_APP_SECRET;
const instagramRedirectUri = process.env.REACT_APP_INSTAGRAM_REDIRECT_URI;
const instagramScope = process.env.REACT_APP_INSTAGRAM_SCOPE;

const instagramAuthStore = {
    status: null,      
    message: null,     
    timestamp: null,  
    tokens: {          
      userId: null,
      accessToken: null,
      expiresAt: null
    }
};
  
/**
 * Updates the authentication status in the Instagram auth store
 * 
 * @param {string} status - The authentication status ('success', 'failed', 'disconnected', etc.)
 * @param {string} message - A descriptive message about the authentication status
 * @param {Object} tokenData - Optional token data to store if authentication was successful
 * @param {string} tokenData.userId - The Instagram user ID
 * @param {string} tokenData.accessToken - The Instagram access token
 * @param {number} tokenData.expiresAt - Timestamp when the token expires
 */
const updateAuthStatus = (status, message, tokenData = null) => {
    instagramAuthStore.status = status;
    instagramAuthStore.message = message;
    instagramAuthStore.timestamp = Date.now();
    
    if (tokenData) {
      instagramAuthStore.tokens = {
        userId: tokenData.userId,
        accessToken: tokenData.accessToken,
        expiresAt: tokenData.expiresAt
      };
    }
};

/**
 * Disconnects from Instagram by clearing stored tokens
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response indicating success or failure
 */
const disconnectInstagram = async (req, res) => {
    try {
        instagramAuthStore.tokens = {
            userId: null,
            accessToken: null,
            expiresAt: null
        };

        updateAuthStatus('disconnected', 'Instagram disconnected successfully');
        return res.json({
            success: true,
            message: 'Instagram disconnected successfully'
        });
    } catch (error) {
        console.error('Error disconnecting Instagram:', error);
        return res.status(500).json({
            success: false,
            message: 'Error disconnecting Instagram',
            error: error.message
        });
    }
};


/**
 * Exchanges an authorization code for a short-lived Instagram token
 * 
 * @param {string} code - The authorization code from Instagram OAuth redirect
 * @returns {Object} Response containing the access_token and user_id
 * @throws {Error} If credentials are not set or API request fails
 */
const getInstagramShortLivedTokenHelper = async (code) => {
    if (!instagramClientId || !instagramClientSecret || !instagramRedirectUri) {
        throw new Error('Instagram credentials are not set');
    }

    const formData = new FormData();
    formData.append('client_id', instagramClientId);
    formData.append('client_secret', instagramClientSecret);
    formData.append('grant_type', 'authorization_code');
    formData.append('redirect_uri', instagramRedirectUri);
    formData.append('code', code);


    try {
        const response = await axios.post('https://api.instagram.com/oauth/access_token',
            formData,
            {
                headers: {
                    'content-type': 'multipart/form-data'
                }
            }
        );


        return response.data;
    } catch (error) {
        console.error('Error requesting short-lived token from Instagram:', error.response?.data || error.message);
        throw new Error('Error requesting short-lived token from Instagram');
    }
}

/**
 * Exchanges a short-lived token for a long-lived Instagram token
 * 
 * @param {string} shortLivedToken - The short-lived access token
 * @returns {Object} Response containing the long-lived access_token and expires_in
 * @throws {Error} If credentials are not set or API request fails
 */
const getInstagramLongLivedTokenHelper = async (shortLivedToken) => {
    if (!instagramClientId || !instagramClientSecret) {
        throw new Error('Instagram credentials are not set');
    }


    try {
        const response = await axios.get('https://graph.instagram.com/access_token', {
            params: {
                grant_type: 'ig_exchange_token',
                client_secret: instagramClientSecret,
                access_token: shortLivedToken
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error requesting long-lived token from Instagram:', error.response?.data || error.message);
        throw new Error('Error requesting long-lived token from Instagram');
    }

}

/**
 * Generates the Instagram authentication URL
 * 
 * @returns {Object} An object containing the authentication URL and state
 */
function getInstagramAuth() {
    if (!instagramClientId || !instagramRedirectUri || !instagramScope) {
        throw new Error('Instagram credentials are not properly configured');
    }

    const state = crypto.randomBytes(16).toString('hex');
    const authUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&client_id=${instagramClientId}&redirect_uri=${encodeURIComponent(instagramRedirectUri)}&response_type=code&scope=${instagramScope}&state=${state}`;

    return {
        url: authUrl,
        state
    };
    
}

/**
 * Generates the Instagram authentication URL and returns it in JSON format
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON with the authentication URL and state
 * @throws {Error} If an error occurs while generating the URL
 */
const getInstagramAuthUrl = async (req, res) => {
    try {
        const authUrl = getInstagramAuth();
        return res.json({
            success: true,
            url: authUrl.url,
            state: authUrl.state
        });
    } catch (error) {
        console.error('Error generating Instagram auth URL:', error);
        return res.status(500).json({
            success: false,
            message: 'Error generating Instagram auth URL',
            error: error.message
        });
    }
};

/**
 * Generates an HTML response page for Instagram authentication result
 * 
 * @param {Object} res - Express response object
 * @param {boolean} success - Whether authentication was successful
 * @param {string} message - The message to display to the user
 */
function sendResponsePage(res, success, message) {
    const color = success ? 'green' : 'red';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Instagram Authentication ${success ? 'Success' : 'Failed'}</title>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
            .message { color: ${color}; font-size: 18px; margin: 20px; }
            .redirecting { font-size: 14px; margin-top: 30px; color: #666; }
        </style>
    </head>
    <body>
        <h2>Instagram Authentication</h2>
        <div class="message">${message}</div>
        <div class="redirecting">Closing in 2 seconds...</div>
        
        <script>
            setTimeout(function() {
                window.close();
            }, 2000);
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
}

/**
 * Handles the Instagram OAuth redirect callback
 * Exchanges the authorization code for tokens and stores them
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.query.code - The authorization code from Instagram
 * @param {Object} res - Express response object
 * @returns {Object} HTML response page or error JSON
 */
const handleInstagramAuthCallback = async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({
            success: false,
            message: 'Authorization code is required'
        });
    }


    try {
        const shortLivedToken = await getInstagramShortLivedTokenHelper(code);
        if (!shortLivedToken) {
            return res.status(500).json({
                success: false,
                message: 'Error requesting short-lived token from Instagram'
            });
        }

        const longLivedToken = await getInstagramLongLivedTokenHelper(shortLivedToken.access_token);
        if (!longLivedToken) {
            return res.status(500).json({
                success: false,
                message: 'Error requesting long-lived token from Instagram'
            });
        }

        updateAuthStatus('success', 'Instagram authentication successful', {
            userId: shortLivedToken.user_id,
            accessToken: longLivedToken.access_token,
            expiresAt: Date.now() + (longLivedToken.expires_in * 1000)
        });

        return sendResponsePage(res, true, 'Instagram auth callback received successfully');
    } catch (error) {
        console.error('Error handling Instagram auth callback:', error.message);
        updateAuthStatus('failed', 'Instagram authentication failed', null);
        return sendResponsePage(res, false, 'Instagram auth callback failed');
    }
}

/**
 * Returns the current Instagram authentication status
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON with authentication status, message, and token data
 */
const getInstagramAuthStatus = async (req, res) => res.json({
    success: instagramAuthStore.status === 'success',
    status: instagramAuthStore.status || 'unknown',
    message: instagramAuthStore.message || 'No authentication attempt recorded',
    timestamp: instagramAuthStore.timestamp,
    data: instagramAuthStore.status === 'success' ? {
        userId: instagramAuthStore.tokens.userId,
        // Don't expose the actual token for security reasons
        hasValidToken: !!instagramAuthStore.tokens.accessToken,
        tokenExpires: instagramAuthStore.tokens.expiresAt
    } : null
});

/**
 * Retrieves the Instagram user ID using an access token
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} [req.body.accessToken] - Optional access token (falls back to stored token)
 * @param {Object} res - Express response object
 * @returns {Object} JSON with user ID and success information
 */
const getInstagramUserId = async (req, res) => {
    const { accessToken } = req.body;
    let access_token = accessToken;
    // If no token provided in the request, try to use the stored token
    if (!access_token) {
        access_token = instagramAuthStore.tokens.accessToken;
    }

    if (!access_token) {
        return res.status(400).json({ error: 'Access token is required' });
    }

    try {
        const response = await axios.get('https://graph.instagram.com/me', 
            {
                params: { access_token }
            }
        );


        return res.json({
            ...response.data,
            success: true,
            message: 'Instagram user ID received successfully'
        });
    } catch (error) {
        console.error('Error requesting instagram user ID:', error.response?.data || error.message);
        return res.status(500).json({
            success: false,
            message: 'Error requesting instagram user ID',
            error: error.response?.data || error.message
        });
    }
}

/**
 * Retrieves a fresh access token from Imgur API
 * 
 * @returns {string|null} The Imgur access token or null if request failed
 */
const getImgurAccessTokenHelper = async () => {
    try {
        const response = await axios.post('https://api.imgur.com/oauth2/token', 
            new URLSearchParams({
                'client_id': imgurClientId,
                'client_secret': imgurClientSecret,
                'grant_type': 'refresh_token',
                'refresh_token': imgurRefreshToken
            }), {
                headers: {
                    'content-type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting Imgur access token:', 
            error.response?.data || error.message);
        return null;
    }
}

/**
 * Uploads an image to Imgur
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.file - The uploaded file from multer
 * @param {Buffer} req.file.buffer - The file data buffer
 * @param {string} req.file.originalname - Original filename
 * @param {Object} res - Express response object
 * @returns {Object} JSON with Imgur upload response
 */
const uploadImageToImgur = async (req, res) => {
    
    const image = req.file;

    if (!image) {
        return res.status(400).json({ error: 'Image file is required' });
    }

    const imgurAccessToken = await getImgurAccessTokenHelper();

    if (!imgurAccessToken) {
        return res.status(500).json({ error: 'Failed to get Imgur access token' });
    }

    const formData = new FormData();
    formData.append('image', image.buffer, image.originalname);
    formData.append('type', 'file');

    try {
        const response = await axios.post('https://api.imgur.com/3/image',
            formData,
            {
                headers: {
                    Authorization: `Bearer ${imgurAccessToken}`,
                    'content-type': 'multipart/form-data'
                }
            }
        );

        return res.json({
            ...response.data,
            success: true,
            message: 'Image uploaded to Imgur successfully'
        });
    } catch (error) {
        console.error('Error uploading image to Imgur:', error.response.data);
        return res.status(500).json({
            success: false,
            message: 'Error uploading image to Imgur',
            error: error.response.data
        });
    }
}

/**
 * Deletes an image from Imgur
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.deleteHash - The Imgur image delete hash
 * @param {Object} res - Express response object
 * @returns {Object} JSON response indicating success or failure
 */
const deleteImageFromImgur = async (req, res) => {
    const { deleteHash } = req.body;


    if (!deleteHash) {
        return res.status(400).json({ error: 'Access token and image hash are required' });
    }

    const imgurAccessToken = await getImgurAccessTokenHelper();

    if (!imgurAccessToken) {
        return res.status(500).json({ error: 'Failed to get Imgur access token' });
    }

    try {
        const response = await axios.delete(`https://api.imgur.com/3/image/${deleteHash}`, {
            headers: {
                Authorization: `Bearer ${imgurAccessToken}`
            }
        });

        return res.json({
            ...response.data,
            success: true,
            message: 'Image deleted from Imgur successfully'
        });
    } catch (error) {
        console.error('Error deleting image from Imgur:', error.response.data);
        return res.status(500).json({
            success: false,
            message: 'Error deleting image from Imgur',
            error: error.response.data
        });
    }
}

/**
 * Helper function to delete an image from Imgur
 * 
 * @param {string} deleteHash - The Imgur image delete hash
 * @returns {Object} Imgur API response data
 * @throws {Error} If delete hash is missing or request fails
 */
const deleteImageFromImgurHelper = async (deleteHash) => {
    if (!deleteHash) {
        throw new Error('Image hash is required');
    }

    try {
        const imgurAccessToken = await getImgurAccessTokenHelper();

        if (!imgurAccessToken) {
            throw new Error('Failed to get Imgur access token');
        }

        const response = await axios.delete(`https://api.imgur.com/3/image/${deleteHash}`, {
            headers: {
                Authorization: `Bearer ${imgurAccessToken}`
            }
        });

        return response.data;

    } catch (error) {
        console.error('Error deleting image from Imgur:', error.response?.data || error.message);
        throw new Error('Error deleting image from Imgur');
    }
}

/**
 * Helper function to get Instagram user ID
 * 
 * @param {string} accessToken - Instagram access token
 * @returns {string|null} Instagram user ID or null if request failed
 */
const getInstagramUserIdHelper = async (accessToken) => {
    try {
        const response = await axios.get('https://graph.instagram.com/me', {
            params: { access_token: accessToken }
        });
        return response.data.id;
    } catch (error) {
        console.error('Error requesting Instagram user ID:', 
            error.response?.data || error.message);
        return null;
    }
};

/**
 * Creates an Instagram container (media object) for posting
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.imageUrl - URL to the image
 * @param {string} req.body.caption - Caption for the Instagram post
 * @param {string} [req.body.accessToken] - Optional access token (falls back to stored token)
 * @param {Object} res - Express response object
 * @returns {Object} JSON with container creation result
 */
const createInstagramContainer = async (req, res) => {
    const { imageUrl, caption, accessToken } = req.body;

    let access_token = accessToken;
    // If no token provided in the request, try to use the stored token
    if (!access_token) {
        access_token = instagramAuthStore.tokens.accessToken;
    }

    if (!imageUrl || !caption || !access_token) {
        return res.status(400).json({ error: 'Image URL, caption, and access token are required' });
    }

    const userId = await getInstagramUserIdHelper(access_token);
    if (!userId) {
        return res.status(500).json({ error: 'Failed to get Instagram user ID' });
    }

    const params = {
        caption,
        access_token,
        image_url: imageUrl,
    }


    try {
        const response = await axios.post(`https://graph.instagram.com/${userId}/media`, 
            null, 
            { params }
        ); 

        return res.json({
            ...response.data,
            success: true,
            message: 'Instagram container created successfully'
        });

    } catch (error) {
        console.error('Error creating Instagram container:', error.response.data);
        return res.status(500).json({
            success: false,
            message: 'Error creating Instagram container',
            error: error.response.data
        });
    }
}

/**
 * Helper function to create an Instagram container
 * 
 * @param {string} imageUrl - URL to the image
 * @param {string} caption - Caption for the Instagram post
 * @returns {Object} Instagram API container creation response
 * @throws {Error} If parameters are missing or request fails
 */
const createInstagramContainerHelper = async (imageUrl, caption) => {
    try {
        if (!imageUrl || !caption) {
            throw new Error('Image URL and caption are required');
        }

        const access_token = instagramAuthStore.tokens.accessToken;
        if (!access_token) {
            throw new Error('No valid Instagram access token found');
        }

        const userId = await getInstagramUserIdHelper(access_token);
        if (!userId) {
            throw new Error('Failed to get Instagram user ID');
        }

        const params = {
            caption,
            access_token,
            image_url: imageUrl,
        }

        const response = await axios.post(`https://graph.instagram.com/${userId}/media`, 
            null, 
            { params }
        ); 

        return response.data;
    } catch (error) {
        console.error('Error creating Instagram container:', error.response.data);
        throw new Error('Error creating Instagram container');
    }
}

/**
 * Publishes an Instagram container to make it visible on Instagram
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.containerId - The container ID from Instagram
 * @param {string} [req.body.accessToken] - Optional access token (falls back to stored token)
 * @param {Object} res - Express response object
 * @returns {Object} JSON with publish result
 */
const publishInstagramContainer = async (req, res) => {
    const { containerId, accessToken } = req.body;

    let access_token = accessToken;
    // If no token provided in the request, try to use the stored token
    if (!access_token) {
        access_token = instagramAuthStore.tokens.accessToken;
    }

    if (!containerId || !access_token) {
        return res.status(400).json({ error: 'Container ID and access token are required' });
    }

    const userId = await getInstagramUserIdHelper(access_token);
    if (!userId) {
        return res.status(500).json({ error: 'Failed to get Instagram user ID' });
    }

    const params = {
        access_token,
        creation_id: containerId
    }

    try {
        const response = await axios.post(`https://graph.instagram.com/${userId}/media_publish`, 
            null, 
            { params }
        );

        return res.json({
            ...response.data,
            success: true,
            message: 'Instagram container published successfully'
        });
    } catch (error) {
        console.error('Error publishing Instagram container:', error.response.data);
        return res.status(500).json({
            success: false,
            message: 'Error publishing Instagram container',
            error: error.response.data
        });
    }
}

/**
 * Helper function to publish an Instagram container
 * 
 * @param {string} containerId - The container ID from Instagram
 * @returns {Object} Instagram API publish response
 * @throws {Error} If container ID is missing or request fails
 */
const publishInstagramContainerHelper = async (containerId) => {
    try {
        if (!containerId) {
            throw new Error('Container ID is required');
        }

        const access_token = instagramAuthStore.tokens.accessToken;
        if (!access_token) {
            throw new Error('No valid Instagram access token found');
        }

        const userId = await getInstagramUserIdHelper(access_token);
        if (!userId) {
            throw new Error('Failed to get Instagram user ID');
        }

        const params = {
            access_token,
            creation_id: containerId
        }

        const response = await axios.post(`https://graph.instagram.com/${userId}/media_publish`, 
            null, 
            { params }
        );

        return response.data;
    } catch (error) {
        console.error('Error publishing Instagram container:', error.response.data);
        throw new Error('Error publishing Instagram container');
    }
}

/**
 * Publishes a scheduled post to Instagram
 * 
 * @param {string} jobId - The job ID of the scheduled post
 * @returns {void}
 * @throws {Error} If post not found, no token available, or request fails
 */
const publishScheduledPost = async (jobId) => {

    try {
        const post = await InstagramScheduledPost.findOne({ jobId });
        if (!post) {
            throw new Error('Scheduled post not found');
        }

        if (!instagramAuthStore.tokens.accessToken) {
            throw new Error('No valid Instagram access token found');
        }

        const { imgurImageUrl, caption } = post;
        const containerResponse = await createInstagramContainerHelper(imgurImageUrl, caption);

        const { id: containerId } = containerResponse;
        const postResponse = await publishInstagramContainerHelper(containerId);

        await InstagramScheduledPost.findOneAndUpdate(
            { jobId },
            { status: 'published' }
        );

    } catch (error) {
        console.error('Error publishing scheduled post:', error);
        throw new Error('Error publishing scheduled post');
    }
}

const scheduledJobs = new Map();

/**
 * Helper function to schedule an Instagram post for later publication
 * 
 * @param {string} jobId - The job ID of the scheduled post
 * @param {string|Date} scheduledTime - The time when the post should be published
 * @returns {void}
 */
const scheduleInstagramPostHelper = async (jobId, scheduledTime) => {
    const job = schedule.scheduleJob(new Date(scheduledTime), async () => {
        try {
            await publishScheduledPost(jobId);
            scheduledJobs.delete(jobId);
        } catch (error) {
            console.error('Error publishing scheduled post:', error);
            await InstagramScheduledPost.findOneAndUpdate(
                { jobId },
                { status: 'failed' }
            );
        }
        
    });

    scheduledJobs.set(jobId, job);
}

/**
 * Schedules an Instagram post for later publication
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.imgurImageUrl - URL to the image on Imgur
 * @param {string} req.body.imgurDeleteHash - Imgur delete hash for cleanup
 * @param {string} req.body.caption - Caption for the Instagram post
 * @param {string|Date} req.body.scheduledTime - When to publish the post
 * @param {Object} res - Express response object
 * @returns {Object} JSON with scheduling result and created post data
 */
const scheduleInstagramPost = async (req, res) => {
    const { imgurImageUrl, imgurDeleteHash, caption, scheduledTime } = req.body;

    try {
        if (!imgurImageUrl || !imgurDeleteHash || !caption || !scheduledTime) {
            return res.status(400).json({
                success: false,
                message: 'Image URL, delete hash, caption, and scheduled time are required'
            });
        }

        const jobId = crypto.randomUUID();
        const scheduledPost = await InstagramScheduledPost.create({
            jobId,
            imgurImageUrl,
            imgurDeleteHash,
            caption,
            scheduledTime: new Date(scheduledTime),
            status: 'scheduled'
        });
        await scheduleInstagramPostHelper(jobId, scheduledTime);

        return res.json({
            success: true,
            message: 'Scheduled post created successfully',
            scheduledPost
        });
        
    } catch (error) {
        console.error('Error scheduling Instagram post:', error);
        return res.status(500).json({
            success: false,
            message: 'Error scheduling Instagram post',
            error: error.message
        });
    }
}

/**
 * Deletes a scheduled Instagram post
 * 
 * @param {Object} req - Express request object
 * @param {Object} req.params - URL parameters
 * @param {string} req.params.jobId - The job ID of the scheduled post
 * @param {Object} res - Express response object
 * @returns {Object} JSON response indicating success or failure
 */
const deleteInstagramPostByJobId = async (req, res) => {
    const { jobId } = req.params;

    if (!jobId) {
        return res.status(400).json({ error: 'Job ID is required' });
    }

    try {
        const post = await InstagramScheduledPost.findOne({ _id: jobId });
        if (!post) {
            return res.status(404).json({ error: 'Scheduled post not found' });
        }

        if (!instagramAuthStore.tokens.accessToken) {
            return res.status(500).json({ error: 'No valid Instagram access token found' });
        }

        const job = scheduledJobs.get(jobId);
        if (job) {
            job.cancel();
            scheduledJobs.delete(jobId);
        }


        await InstagramScheduledPost.deleteOne({ _id: jobId });

        let imgurDeleteSuccess = true;
        let imgurDeleteResponse = null;
        
        try {
            const deleteHash = post.imgurDeleteHash;
            imgurDeleteResponse = await deleteImageFromImgurHelper(deleteHash);
        } catch (imgurError) {
            // Just log the error but continue with the database deletion
            console.warn('Warning: Failed to delete image from Imgur:', imgurError.message);
            imgurDeleteSuccess = false;
        }

        return res.json({ 
            success: true,
            message: 'Scheduled post deleted successfully',
            imgurDeleteSuccess,
            imgurDeleteResponse
         });
    } catch (error) {
        console.error('Error deleting Instagram post:', error);
        return res.status(500).json({
            success: false,
            message: 'Error deleting Instagram post',
            error: error.message
        });
    }
}

/**
 * Gets all scheduled Instagram posts
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON with array of scheduled posts
 */
const getAllInstagramPosts = async (req, res) => {
    try {
        const posts = await InstagramScheduledPost.find();
        return res.json({
            success: true,
            posts
        });
        
    } catch (error) {
        console.error('Error fetching Instagram posts:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching Instagram posts',
            error: error.message
        });
    }
}

module.exports = {
    getInstagramAuthUrl,
    handleInstagramAuthCallback,
    disconnectInstagram,
    getInstagramAuthStatus,
    getInstagramUserId,
    getImgurAccessTokenHelper,
    uploadImageToImgur,
    deleteImageFromImgur,
    createInstagramContainer,
    publishInstagramContainer,

    scheduleInstagramPost,
    deleteInstagramPostByJobId,
    getAllInstagramPosts
};