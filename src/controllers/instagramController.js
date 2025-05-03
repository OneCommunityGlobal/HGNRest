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

const getInstagramShortLivedToken = async (req, res) => {
    if (!instagramClientId || !instagramClientSecret || !instagramRedirectUri) {
        return res.status(500).json({ error: 'Instagram credentials are not set' });
    }

    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Code is required' });
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

        return res.json({
            ...response.data,
            success: true,
            message: 'Instagram access token generated successfully'
        });
    } catch (error) {
        console.error('Error requesting short-lived token from Instagram:', error.response?.data || error.message);
        return res.status(500).json({
            success: false,
            message: 'Error requesting short-lived token from Instagram',
            error: error.response?.data || error.message
        });
    }

}

const getInstagramLongLivedToken = async (req, res) => {
    if (!instagramClientId || !instagramClientSecret) {
        return res.status(500).json({ error: 'Instagram credentials are not set' });
    }

    const { shortLivedToken } = req.body;

    if (!shortLivedToken) {
        return res.status(400).json({ error: 'Short-lived token is required' });
    }

    try {
        const response = await axios.get('https://graph.instagram.com/access_token', {
            params: {
              grant_type: 'ig_exchange_token',
              client_secret: instagramClientSecret,
              access_token: shortLivedToken
            }
        });

        console.log('Instagram long-lived token received:', response.data);
        return res.json({
            ...response.data,
            success: true,
            message: 'Instagram long-lived token received successfully'
        });
    } catch (error) {
        console.error('Error requesting long-lived token from Instagram:', error.response?.data || error.message);
        return res.status(500).json({
            success: false,
            message: 'Error requesting long-lived token from Instagram',
            error: error.response?.data || error.message
        });
    }
}

const getInstagramUserId = async (req, res) => {
    const { accessToken } = req.body;

    if (!accessToken) {
        return res.status(400).json({ error: 'Access token is required' });
    }

    const access_token = accessToken

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
        console.error('Error requesting instagram user ID:', error.response.data);
        return res.status(500).json({
            success: false,
            message: 'Error requesting instagram user ID',
            error: error.response.data
        });
    }
}

// const getImgurAccessToken = async (req, res) => {
//     if (!imgurClientId || !imgurClientSecret || !imgurRefreshToken) {
//         return res.status(500).json({ error: 'Imgur credentials are not set' });
//     }

//     const formData = new FormData();
//     formData.append('client_id', imgurClientId);
//     formData.append('client_secret', imgurClientSecret);
//     formData.append('grant_type', 'refresh_token');
//     formData.append('refresh_token', imgurRefreshToken);

//     try {
//         const response = await axios.post('https://api.imgur.com/oauth2/token',
//             formData,
//             {
//                 headers: {
//                     'content-type': 'multipart/form-data'
//                 }
//             }
//         );

//         console.log('Imgur access token received:', response.data);

//         return res.json({
//             ...response.data,
//             success: true,
//             message: 'Imgur access token generated successfully'
//         });
//     } catch (error) {
//         console.error('Error requesting access token from Imgur:', error.response.data);
//         return res.status(500).json({
//             success: false,
//             message: 'Error requesting access token from Imgur',
//             error: error.response.data
//         });
//     }
// }

const getImgurAccessToken = async () => {
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

    const imgurAccessToken = await getImgurAccessToken();

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
    const {deleteHash } = req.body;

    if (!deleteHash) {
        return res.status(400).json({ error: 'Access token and image hash are required' });
    }

    const imgurAccessToken = await getImgurAccessToken();

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

    if (!imageUrl || !caption || !accessToken) {
        return res.status(400).json({ error: 'Image URL, caption, and access token are required' });
    }

    const userId = await getInstagramUserIdHelper(accessToken);
    if (!userId) {
        return res.status(500).json({ error: 'Failed to get Instagram user ID' });
    }

    const params = {
        caption,
        access_token: accessToken,
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

    if (!containerId || !accessToken) {
        return res.status(400).json({ error: 'Container ID and access token are required' });
    }

    const userId = await getInstagramUserIdHelper(accessToken);
    if (!userId) {
        return res.status(500).json({ error: 'Failed to get Instagram user ID' });
    }

    const params = {
        access_token: accessToken,
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
    getInstagramShortLivedToken,
    getInstagramLongLivedToken,
    getInstagramUserId,
    getImgurAccessToken,
    uploadImageToImgur,
    deleteImageFromImgur,
    createInstagramContainer,
    publishInstagramContainer
};