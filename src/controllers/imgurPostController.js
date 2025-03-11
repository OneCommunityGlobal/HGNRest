// const fs = require('fs');
const axios = require('axios');
require ('dotenv').config();
const FormData = require('form-data');
const schedule = require('node-schedule');


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

const uploadImageToImgur = async (file, title, description, ACCESS_TOKEN) => {
    const formData = new FormData();
    formData.append('image', file.buffer, file.originalname);
    formData.append('type', 'file');
    formData.append('title', title);
    formData.append('description', description);

    try {
        const response = await axios.post('https://api.imgur.com/3/image', formData, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                ...formData.getHeaders(),
            },
        });
        return response.data.data.id;
    } catch (e) {
        console.error('Error uploading image to Imgur:', e.response?.data || e.message);
        throw new Error('Error uploading image to Imgur');
    }
}

const deleteImageFromImgur = async (imageHash, ACCESS_TOKEN) => {
    try {
        const response = await axios.delete(`https://api.imgur.com/3/image/${imageHash}`, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
            },
        });
        console.log('Delete response:', response.data);
    } catch (e) {
        console.error('Error deleting image from Imgur:', e.response?.data || e.message);
    }
};

const postImageToGallery = async (imageHash, title, ACCESS_TOKEN) => {
    const tags = "autopost,bot,imgur";
    const formData = new FormData();
    formData.append('title', title || 'test title');
    formData.append('topic', 'No Topic');
    formData.append('terms', 1);
    formData.append('tags', tags);

    try {
        const response = await axios.post(`https://api.imgur.com/3/gallery/image/${imageHash}`, formData, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
            },
        });
        return response.data;
    } catch (e) {
        console.error('Error posting to Imgur:', e.response?.data || e.message);
        await deleteImageFromImgur(imageHash, ACCESS_TOKEN);
        throw new Error('Error posting to Imgur');
    }
};

const publishToImgur = async (file, title, description) => {
    if (!file || !file.buffer || !file.originalname) {
        throw new Error('File must be provided');
    }

    const ACCESS_TOKEN = await getImgurAccessToken();
    const imageHash = await uploadImageToImgur(file, title, description, ACCESS_TOKEN);
    const result = await postImageToGallery(imageHash, title, ACCESS_TOKEN);
    return result;
}

const postToImgur = async (req, res) => {
    try {
        console.log('Posting to Imgur with body:', {
            body: req.body,
            file: req.file,
        });

        const { title, description } = req.body;
        const { file } = req;

        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'Missing image',
            });
        }

        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Missing title',
            });
        }

        if (!description) {
            return res.status(400).json({
                success: false,
                message: 'Missing description',
            });
        }

        console.log('calling publishToImgur with file, title, and description:', file, title, description);
        const result = await publishToImgur(file, title, description);

        console.log('Successfully posted to Imgur');
        res.status(200).json({
            success: true,
            message: 'Successfully posted to Imgur',
            data: result,
        });
    } catch (e) {
        console.error('Error posting to Imgur:', e);
        res.status(e.response?.status || 500).json({
            success: false,
            message: e.response?.data?.message || 'Failed to post to Imgur',
            error: e.response?.data || e.message,
        });
    }
};

module.exports = {
    postToImgur,
};