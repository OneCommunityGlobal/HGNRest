// const fs = require('fs');
const axios = require('axios');
require ('dotenv').config();
const FormData = require('form-data');

const getImgurAccessToken = async () => {
    const {IMGUR_CLIENT_ID, IMGUR_CLIENT_SECRET, IMGUR_REFRESH_TOKEN, IMGUR_REDIRECT_URI} = process.env;

    if (!IMGUR_CLIENT_ID || !IMGUR_CLIENT_SECRET || !IMGUR_REDIRECT_URI) {
        throw new Error('IMGUR_CLIENT_ID, IMGUR_CLIENT_SECRET, and IMGUR_REDIRECT_URI must be set in the environment variables');
    }

    // console.log('Getting Imgur access token');

    try {
        const response = await axios.post(
            'https://api.imgur.com/oauth2/token',
            new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: IMGUR_CLIENT_ID,
                client_secret: IMGUR_CLIENT_SECRET,
                refresh_token: IMGUR_REFRESH_TOKEN,
            })
        );
        // console.log('Response from Imgur:', response.data);
        return response.data.access_token;
    } catch (e) {
        // console.error('Error getting Imgur access token:', e.response?.data || e.message);
        throw new Error('Error getting Imgur access token');
    }
};

const publishToImgur = async (file, title, description) => {
    // console.log('inside publishToImgur with file, title, and description:', file, title, description);
    const ACCESS_TOKEN = await getImgurAccessToken(); // get access token

    // console.log('Publishing to Imgur with image, title, and description:', file, title, description);
    // console.log('Access token:', ACCESS_TOKEN);
    if (file && file.buffer && file.originalname) {
        const formData = new FormData();
        formData.append('image', file.buffer, file.originalname);
        formData.append('type', 'file');
        formData.append('title', title);
        formData.append('description', description);
        // console.log('Posting to Imgur with formData:', formData);


        await axios.post('https://api.imgur.com/3/image', formData, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                ...formData.getHeaders(),
            }
        })
    }

}

const postToImgur = async (req, res) => {
    try {
        console.log('Posting to Imgur with body:', {
            body: req.body,
            file: req.file,
        });

        const { title, description } = req.body;

        // console.log('calling publishToImgur with file, title, and description:', req.file, title, description);
        const result = await publishToImgur(req.file, title, description);

        // console.log('Successfully posted to Imgur');
        res.status(200).json({
            success: true,
            message: 'Successfully posted to Imgur',
            data: result
        });
    } catch (e) {
        console.error('Error posting to Imgur:', e);
        res.status(e.respnse?.status || 500).json({
            success: false,
            message: e.response?.data?.message || 'Failed to post to Imgur',
            error: e.response?.data || e.message,
        });
    }
}

module.exports = {
    postToImgur,
};