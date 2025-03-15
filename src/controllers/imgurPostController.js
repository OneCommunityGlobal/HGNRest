// const fs = require('fs');
const axios = require('axios');
require ('dotenv').config();
const FormData = require('form-data');
const schedule = require('node-schedule');
const { v4: uuidv4 } = require('uuid');

const scheduledPosts = new Map();

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



const uploadImageToImgur = async (file, ACCESS_TOKEN) => {
    const formData = new FormData();
    formData.append('image', file.buffer, file.originalname);
    formData.append('type', 'file');
    formData.append('title', `${file.originalname}`);
    formData.append('description', `${file.description}`);

    try {
        const response = await axios.post('https://api.imgur.com/3/image', formData, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'multipart/form-data',
            },
        });

        console.log('Upload images to imgur response:', response.data);
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

const deleteAlbumFromImgur = async (albumHash, ACCESS_TOKEN) => {
    try {
        const response = await axios.delete(`https://api.imgur.com/3/album/${albumHash}`, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
            },
        });
        console.log('Delete response:', response.data);
    } catch (e) {
        console.error('Error deleting album from Imgur:', e.response?.data || e.message);
    }
}

const createImgurAlbum = async(title, description, ACCESS_TOKEN) => {
    try {
        const response = await axios.post('https://api.imgur.com/3/album', {
            title,
            description,
            privacy: 'hidden',
        }, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
            },
        });

        console.log('Create album response:', response.data);
        return response.data.data.id;
    } catch (e) {
        console.error('Error creating album on Imgur:', e.response?.data || e.message);
        throw new Error('Error creating album on Imgur');
    }
}

const uploadImagesToAlbum = async (imageHashes, albumHash, ACCESS_TOKEN) => {
    
    const formData = new FormData();
    imageHashes.forEach((imageHash) => {
        formData.append('ids', imageHash);
    })

    try {
        const response = await axios.post(`https://api.imgur.com/3/album/${albumHash}/add`, formData, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'multipart/form-data',
            },
        })

        console.log('Upload images to album response:', response.data);
        return response.data;
    } catch (e) {
        console.error('Error uploading images to album:', e.response?.data || e.message);
        imageHashes.forEach(async (imageHash) => {
            await deleteImageFromImgur(imageHash, ACCESS_TOKEN);
        });
        throw new Error('Error uploading images to album');
    }
}

const postAlbumToGallery = async (albumHash, title, tags, topic, ACCESS_TOKEN) => {
    try {
        const response = await axios.post(`https://api.imgur.com/3/gallery/album/${albumHash}`, {
            title,
            topic,
            terms: 1,
            tags,
        }, {
            headers: {
                Authorization: `Bearer ${ACCESS_TOKEN}`,
            },
        });

        console.log('Post album to gallery response:', response.data);
        return response.data;
    } catch (e) {
        console.error('Error posting album to gallery:', e.response?.data || e.message);
        throw new Error('Error posting album to gallery');
    }
}

const getImageHashes = async (files, ACCESS_TOKEN) => {

    const imageHashes = await Promise.all(files.map(async (file) => {
        try {
            const imageHash = await uploadImageToImgur(file, ACCESS_TOKEN);
            return imageHash;
        } catch (e) {
            console.error('Error getting image hashes:', e.response?.data || e.message);
            return null;
        }
    }));

    console.log('getImageHashes:', imageHashes);

    return imageHashes.filter((imageHash) => imageHash !== null);

}

const publishToImgur = async (title, files, description, tags, topic) => {

    const ACCESS_TOKEN = await getImgurAccessToken();
    try {
        // get image hashes by uploading images to Imgur
        const imageHashes = await getImageHashes(files, ACCESS_TOKEN);

        // create imgur album
        const albumHash = await createImgurAlbum(title, 'weekly report', ACCESS_TOKEN);

        // upload images to imgur album with image hashes
        await uploadImagesToAlbum(imageHashes, albumHash, ACCESS_TOKEN);

        // post album to gallery
        const result = await postAlbumToGallery(albumHash, title, tags, topic, ACCESS_TOKEN);

        console.log('Successfully posted to Imgur');
        // res.status(200).json({
        //     success: true,
        //     message: 'Successfully posted to Imgur',
        //     data: result,
        // });
    } catch (e) {
        console.error('Error posting to Imgur:', e.response?.data || e.message);
        throw new Error('Error posting to Imgur');
    }
}

const postToImgur = async (req, res) => {
    try {

        const { title, description, tags, topic, scheduleTime } = req.body;

        console.log('Received request to post to Imgur:', req.body);

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

        if (!description || description.length !== req.files.length) {
            return res.status(400).json({
                success: false,
                message: 'Missing description',
            });
        }

        if (scheduleTime) {
            console.log('scheduling post for:', new Date(scheduleTime));
            const scheduledDateTime = new Date(scheduleTime);

            if (scheduledDateTime <= new Date()) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid schedule time',
                });
            }

            const jobId = `imgur-post-${Date.now()}`;
            const job = schedule.scheduleJob(scheduledDateTime, async () => {
                try {
                    console.log('executing scheduled job:', jobId);
                    await publishToImgur(title, req.files, description, tags, topic);
                    console.log('Successfully posted to Imgur using scheduled job:', jobId);
                    scheduledPosts.delete(jobId);
                } catch (e) {
                    console.error('Error posting to Imgur using scheduled job:', e.response?.data || e.message);
                }
            })

            scheduledPosts.set(jobId, {
                job,
                title,
                files: req.files?.map((file, index) => ({
                    originalname: file.originalname,
                    description: description[index],
                })),
                tags,
                topic,
                scheduleTime: scheduledDateTime,
            });

            console.log('Successfully scheduled post');

            return res.status(200).json({
                success: true,
                message: 'Successfully scheduled post',
                jobId,
                scheduledTime: scheduledDateTime,
            });
        } 
        

        console.log('publishing immediately');
        await publishToImgur(title, req.files, description, tags, topic);

        console.log('Successfully posted to Imgur');
        res.status(200).json({
            success: true,
            message: 'Successfully posted to Imgur',
        });

    } catch (e) {
        console.error('Error posting to Imgur:', e);
        res.status(e.response?.status || 500).json({
            success: false,
            message: e.response?.data?.message || 'Failed to post to Imgur',
            error: e.response?.data || e.message,
        });
    }
}


// const deleteScheduledPost = (jobId) => {
//     console.log('Deleting scheduled post:', jobId);
//     scheduledPosts.delete(jobId);
// }

const getScheduledPosts = (req, res) => {
    try {
        const scheduledPostsInfo = Array.from(scheduledPosts.entries()).map(([jobId, data]) => ({
            jobId,
            title: data.title,
            tags: data.tags,
            topic: data.topic,
            files: data.files || [],
            description: data.description,
            scheduleTime: data.scheduleTime,
        }));

        res.status(200).json({
            success: true,
            message: 'Successfully fetched scheduled posts',
            scheduledPosts: scheduledPostsInfo,
        });
        
    } catch (e) {
        console.error('Error getting scheduled posts:', e);
        res.status(e.response?.status || 500).json({
            success: false,
            message: e.response?.data?.message || 'Failed to get scheduled posts',
            error: e.response?.data || e.message,
        });
    }
}

module.exports = {
    postToImgur,
    getScheduledPosts,
    // deleteScheduledPost,
};