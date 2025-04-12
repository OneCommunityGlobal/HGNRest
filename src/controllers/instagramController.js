const path = require('path');
// const fs = require('fs');
const axios = require('axios');
require ('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const getInstagram = async (req, res) => {
    try {
        console.log('Instagram API called');
        res.status(200).send('Instagram API called');
    } catch (error) {
        console.error('Error fetching Instagram data:', error);
        res.status(500).send('Internal Server Error');
    }
};

const getInstagramCallback = async (req, res) => {
    try {
        console.log('Instagram callback called');
        // const { code } = req.query;
        res.status(200).send('Instagram');
    } catch (error) {
        console.error('Error fetching Instagram data:', error);
        res.status(500).send('Internal Server Error');
    }
};

const exchangeToken = async (req, res) => {
    console.log('Exchange token called');
    console.log('Request body:', req.body); // Log the request body for debugging
    try {
        const { code } = req.body;

        // Parameters needed for the token exchange
        const params = new URLSearchParams();
        params.append('client_id', process.env.INSTAGRAM_APP_ID);
        params.append('client_secret', process.env.INSTAGRAM_APP_SECRET);
        params.append('grant_type', 'authorization_code');
        params.append('redirect_uri', process.env.REDIRECT_URI);
        params.append('code', code);
        
        // Make the request to Instagram
        const response = await axios.post('https://api.instagram.com/oauth/access_token', params);
        
        // Get short-lived access token
        const shortLivedToken = response.data.access_token;
        
        // Exchange for long-lived token (60 days)
        const longLivedTokenResponse = await axios.get('https://graph.instagram.com/access_token', {
        params: {
            grant_type: 'ig_exchange_token',
            client_secret: process.env.INSTAGRAM_APP_SECRET,
            access_token: shortLivedToken
        }
        });

        console.log('Long-lived token response:', longLivedTokenResponse.data);

        res.json({
            success: true,
            access_token: longLivedTokenResponse.data.access_token,
            expires_in: longLivedTokenResponse.data.expires_in
        });
    } catch (error) {
        console.error('Error exchanging token:', error);
        res.status(500).json({
            success: false,
            message: 'Error exchanging token',
            error: error.response ? error.response.data : error.message
        });
    }
}

module.exports = {
    getInstagram,
    getInstagramCallback,
    exchangeToken,
};