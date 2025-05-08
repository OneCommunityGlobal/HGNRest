const path = require('path');
// const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

require ('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const imgurClientId = process.env.REACT_APP_IMGUR_CLIENT_ID;
const imgurClientSecret = process.env.REACT_APP_IMGUR_CLIENT_SECRET;
const imgurRefreshToken = process.env.REACT_APP_IMGUR_REFRESH_TOKEN;

const instagramClientId = process.env.REACT_APP_INSTAGRAM_CLIENT_ID;
const instagramClientSecret = process.env.REACT_APP_INSTAGRAM_APP_SECRET;
const instagramRedirectUri = process.env.REACT_APP_INSTAGRAM_REDIRECT_URI;

const instagramAuthStore = {
    status: null,       // 'success' or 'failed'
    message: null,      // Status message
    timestamp: null,    // When status was last updated
    tokens: {           // Token data if successful
      userId: null,
      accessToken: null,
      expiresAt: null
    }
  };
  
// Helper to update the auth status
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

    console.log('Requesting short-lived token from Instagram...');

    try {
        const response = await axios.post('https://api.instagram.com/oauth/access_token',
            formData,
            {
                headers: {
                    'content-type': 'multipart/form-data'
                }
            }
        );

        console.log('Instagram short-lived token received:', response.data);

        return response.data;
    } catch (error) {
        console.error('Error requesting short-lived token from Instagram:', error.response?.data || error.message);
        throw new Error('Error requesting short-lived token from Instagram');
    }
}

const getInstagramLongLivedTokenHelper = async (shortLivedToken) => {
    if (!instagramClientId || !instagramClientSecret) {
        throw new Error('Instagram credentials are not set');
    }

    console.log('Requesting long-lived token from Instagram...');

    try {
        const response = await axios.get('https://graph.instagram.com/access_token', {
            params: {
                grant_type: 'ig_exchange_token',
                client_secret: instagramClientSecret,
                access_token: shortLivedToken
            }
        });

        console.log('Instagram long-lived token received:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error requesting long-lived token from Instagram:', error.response?.data || error.message);
        throw new Error('Error requesting long-lived token from Instagram');
    }

}

// Helper to send a response page with a message and color
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
            // Close the window after 2 seconds
            setTimeout(function() {
                window.close();
            }, 2000);
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
}

const handleInstagramAuthCallback = async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({
            success: false,
            message: 'Authorization code is required'
        });
    }

    console.log('Instagram auth callback received with code:', code);

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

const getInstagramAuthStatus = async (req, res) => res.json({
    success: instagramAuthStore.status === 'success',
    status: instagramAuthStore.status || 'unknown',
    message: instagramAuthStore.message || 'No authentication attempt recorded',
    timestamp: instagramAuthStore.timestamp,
    data: instagramAuthStore.status === 'success' ? {
        userId: instagramAuthStore.tokens.userId,
        // Don't expose the actual token for security
        hasValidToken: !!instagramAuthStore.tokens.accessToken,
        tokenExpires: instagramAuthStore.tokens.expiresAt
    } : null
});

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

        console.log('Instagram user ID received:', response.data);

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

        console.log('Image uploaded to Imgur:', response.data);
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

const deleteImageFromImgur = async (req, res) => {
    const { deleteHash } = req.body;

    console.log('Deleting image from Imgur with hash:', deleteHash);

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

        console.log('Image deleted from Imgur:', response.data);
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

        console.log('Instagram container created:', response.data);
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

        console.log('Instagram container published:', response.data);
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

module.exports = {
    handleInstagramAuthCallback,
    getInstagramAuthStatus,
    // getInstagramShortLivedToken,
    // getInstagramLongLivedToken,
    getInstagramUserId,
    getImgurAccessTokenHelper,
    uploadImageToImgur,
    deleteImageFromImgur,
    createInstagramContainer,
    publishInstagramContainer
};