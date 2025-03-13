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
                'Content-Type': 'multipart/form-data',
            },
        });

        // console.log('Upload response:', response.data);
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

const uploadImagesToAlbum = async (imageHashes, title, description, ACCESS_TOKEN) => {
    
    const formData = new FormData();
    imageHashes.forEach((imageHash) => {
        formData.append('ids[]', imageHash);
    })
    formData.append('title', title);
    formData.append('description', description);
    formData.append('cover', imageHashes[0]);

    console.log('FormData before sending to Imgur:', {
        ids: imageHashes,
        title,
        description,
        cover: imageHashes[0],
    });

    try {
        const response = await axios.post('https://api.imgur.com/3/album', formData, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    } catch (e) {
        console.error('Error uploading images to album:', e.response?.data || e.message);
        imageHashes.forEach(async (imageHash) => {
            await deleteImageFromImgur(imageHash, ACCESS_TOKEN);
        });
        throw new Error('Error uploading images to album');
    }
}
// const postImagesToGallery = async (imageHashes, title) => {
//     const tags = "autopost,bot,imgur";
//     const formData = new FormData();
//     formData.append('title', title || 'test title');
//     formData.append('topic', 'No Topic');
//     formData.append('terms', 1);
//     formData.append('tags', tags);

//     try {
//         const response = await axios.post(`https://api.imgur.com/3/gallery/image/${imageHash}`, formData, {
//             headers: {
//                 Authorization: `Bearer ${ACCESS_TOKEN}`,
//             },
//         });
//         return response.data;
//     } catch (e) {
//         console.error('Error posting to Imgur:', e.response?.data || e.message);
//         await deleteImageFromImgur(imageHash, ACCESS_TOKEN);
//         throw new Error('Error posting to Imgur');
//     }
// };

const getImageHashes = async (title, description, tags, files, ACCESS_TOKEN) => {

    const imageHashes = await Promise.all(files.map(async (file) => {
        try {
            const imageHash = await uploadImageToImgur(file, title, description, ACCESS_TOKEN);
            return imageHash;
        } catch (e) {
            console.error('Error getting image hashes:', e.response?.data || e.message);
            return null;
        }
    }));

    console.log('imageHashes:', imageHashes);

    return imageHashes.filter((imageHash) => imageHash !== null);

}

const postToImgur = async (req, res) => {
    try {
        console.log('Posting to Imgur with body:', {
            body: req.body,
            scheduleTime: req.body.scheduleTime,
            files: req.files?.map((file) => ({
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
            })),
        });

        const { title, description, tags } = req.body;
        // const {files} = req.files;

        if (!req.files || req.files.length === 0) {
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
        const ACCESS_TOKEN = await getImgurAccessToken();
        // console.log('calling publishToImgur with file, title, and description:', file, title, description);

        // get image hashes by uploading images to Imgur
        const imageHashes = await getImageHashes(title, description, tags, req.files, ACCESS_TOKEN);
        // upload images to imgur album with image hashes
        const result = await uploadImagesToAlbum(imageHashes, title, description, ACCESS_TOKEN);


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