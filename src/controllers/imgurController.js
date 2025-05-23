const path = require('path');
const crypto = require('crypto');
const schedule = require('node-schedule');
const axios = require('axios');
const FormData = require('form-data');
const InstagramScheduledPost = require('../models/instagramPost');

// imgur login url: https://api.imgur.com/oauth2/authorize?client_id=4dc909045d9e9fe&response_type=token

require ('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const imgurClientId = process.env.REACT_APP_IMGUR_CLIENT_ID;
const imgurRedirectUri = process.env.REACT_APP_IMGUR_REDIRECT_URI;
const imgurClientSecret = process.env.REACT_APP_IMGUR_CLIENT_SECRET;
const imgurRefreshToken = process.env.REACT_APP_IMGUR_REFRESH_TOKEN;

const imgurAuthStore = {
    status: null,
    message: null,
    tokens: {
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
    }
}

const updateAuthStatus = (status, message, tokenData = null) => {
    imgurAuthStore.status = status;
    imgurAuthStore.message = message;
    imgurAuthStore.timestamp = Date.now();

    if (tokenData) {
      imgurAuthStore.tokens = {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiresAt: tokenData.expiresAt
      };
    }
};

const disconnectImgur = async (req, res) => {
    try {
        imgurAuthStore.tokens = {
            accessToken: null,
            refreshToken: null,
            expiresAt: null
        };

        updateAuthStatus('disconnected', 'Imgur disconnected successfully');
        return res.json({
            success: true,
            message: 'Imgur disconnected successfully'
        });
    } catch (error) {
        console.error('Error disconnecting Imgur:', error);
        return res.status(500).json({
            success: false,
            message: 'Error disconnecting Imgur',
            error: error.message
        });
    }
};

function getImgurAuth() {
    if (!imgurClientId) {
        throw new Error('Imgur client ID is not configured');
    }

    const state = crypto.randomBytes(16).toString('hex');
    
    // For Implicit Grant flow
    const authUrl = `https://api.imgur.com/oauth2/authorize?client_id=${imgurClientId}&response_type=token&state=${state}&redirect_uri=${encodeURIComponent(callbackUrl)}`;
    
    return {
        url: authUrl,
        state
    };
}

const getImgurAuthUrl = async (req, res) => {
    try {
        const authUrl = getImgurAuth();
        return res.json({
            success: true,
            authUrl: authUrl.url
        });
    } catch (error) {
        console.error('Error generating Imgur auth URL:', error);
        return res.status(500).json({
            success: false,
            message: 'Error generating Imgur auth URL',
            error: error.message
        });
    }
}

function sendResponsePage(res, success, message) {
    const color = success ? 'green' : 'red';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Imgur Authentication ${success ? 'Success' : 'Failed'}</title>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
            .message { color: ${color}; font-size: 18px; margin: 20px; }
            .redirecting { font-size: 14px; margin-top: 30px; color: #666; }
        </style>
    </head>
    <body>
        <h2>Imgur Authentication</h2>
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

const handleImgurAuthCallback = async (req, res) => {
    console.log('Imgur auth callback received');
    const { access_token, expires_in, refresh_token } = req.query;
    console.log('Access Token:', access_token);
    console.log('Expires In:', expires_in);
    console.log('Refresh Token:', refresh_token);

    return sendResponsePage(res, true, 'Imgur authentication successful');
}

module.exports = {
    getImgurAuthUrl,
    handleImgurAuthCallback,
    disconnectImgur
}