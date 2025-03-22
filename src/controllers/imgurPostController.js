// const fs = require('fs');
const axios = require('axios');
require ('dotenv').config();
const FormData = require('form-data');
const schedule = require('node-schedule');
const ImgurScheduledPost = require('../models/imgurPosts');

// const scheduledPosts = new Map();

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

const deleteImageFromImgur = async (imageHash) => {
    const ACCESS_TOKEN = await getImgurAccessToken();
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

const deleteScheduledPost = async (req, res) => {
    console.log('Received request to delete scheduled post:', req.params);
    try {
        const { jobId } = req.params;
        const post = await ImgurScheduledPost.findOne({ jobId });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Scheduled post not found',
            });
        }

        console.log('found post:', post);

        // delete images from imgur
        post.files.forEach(async (file) => {
            await deleteImageFromImgur(file.imageHash);
        });
        
        console.log('deleted images from imgur');
        
        await ImgurScheduledPost.deleteOne({ jobId });

        res.status(200).json({
            success: true,
            message: 'Successfully deleted scheduled post',
            jobId,
        });
    } catch (e) {
        console.error('Error deleting scheduled post:', e);
        res.status(e.response?.status || 500).json({
            success: false,
            message: e.response?.data?.message || 'Failed to delete scheduled post',
            error: e.response?.data || e.message,
        });
    }
}


const createImgurAlbum = async(title, description) => {
    const ACCESS_TOKEN = await getImgurAccessToken();
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

const uploadImagesToAlbum = async (imageHashes, albumHash) => {
    const ACCESS_TOKEN = await getImgurAccessToken();
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

const postAlbumToGallery = async (albumHash, title, tags, topic) => {
    const ACCESS_TOKEN = await getImgurAccessToken();
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

const getImageHashes = async (files, scheduledDateTime='N/A') => {
    const ACCESS_TOKEN = await getImgurAccessToken();
    
    const imageHashes = await Promise.all(files.map(async (file) => {
        try {
            if (scheduledDateTime !== 'N/A') {
                file.description = `(${scheduledDateTime})-${file.description} `;
            }
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

const publishToImgur = async (title, imageHashes, description, tags, topic) => {
    try {
        // get image hashes by uploading images to Imgur
        // const imageHashes = await getImageHashes(files, ACCESS_TOKEN);

        // create imgur album
        const albumHash = await createImgurAlbum(title, 'weekly report');

        // upload images to imgur album with image hashes
        await uploadImagesToAlbum(imageHashes, albumHash);

        // post album to gallery
        const result = await postAlbumToGallery(albumHash, title, tags, topic);

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
        console.log('Received files:', req.files);

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
            const { IMGUR_SCHEDULED_POSTS_ALBUM_HASH } = process.env;
            console.log('scheduling post for:', new Date(scheduleTime));
            const scheduledDateTime = new Date(scheduleTime);
            
            if (scheduledDateTime <= new Date()) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid schedule time',
                });
            }

            // upload images to scheduled posts album in imgur
            const imageHashes = await getImageHashes(req.files, scheduledDateTime);

            await uploadImagesToAlbum(imageHashes, IMGUR_SCHEDULED_POSTS_ALBUM_HASH);

            

            const jobId = `imgur-post-${Date.now()}`;
            const job = schedule.scheduleJob(scheduledDateTime, async () => {
                try {
                    console.log('executing scheduled job:', jobId);
                    await publishToImgur(title, imageHashes, description, tags, topic);
                    console.log('Successfully posted to Imgur using scheduled job:', jobId);

                    console.log('deleting scheduled post in database with jobId:', jobId);
                    await ImgurScheduledPost.deleteOne({ jobId });
                } catch (e) {
                    console.error('Error posting to Imgur using scheduled job:', e.response?.data || e.message);
                }
            })

            // upload to database to preserve scheduled posts if server crashes or restarts
            const newScheduledPost = new ImgurScheduledPost({
                jobId,
                title,
                tags,
                topic,
                files: imageHashes?.map(( hash, index ) => ({
                    imageHash: hash,
                    originalName: req.files[index].originalname,
                    description: description[index],
                })),
                scheduleTime: scheduledDateTime,
            });

            await newScheduledPost.save();

            console.log('Successfully scheduled post');

            return res.status(200).json({
                success: true,
                message: 'Successfully scheduled post',
                jobId,
                newScheduledPost,
                scheduledTime: scheduledDateTime,
            });
        } 
        

        console.log('publishing immediately');
        const imageHashes = await getImageHashes(req.files);
        await publishToImgur(title, imageHashes, description, tags, topic);

        console.log('Successfully posted to Imgur');
        res.status(200).json({
            success: true,
            message: 'Successfully posted to Imgur',
        });

    } catch (e) {
        console.error('Error posting to Imgur in postToImgur:', e);
        // delete images from imgur if post fails
        req.files.forEach(async (file) => {
            await deleteImageFromImgur(file.imageHash);
        });
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

const getScheduledPosts = async (req, res) => {
    try {
        const scheduledPosts = await ImgurScheduledPost.find({}).populate('files');
        res.status(200).json({
            success: true,
            message: 'Successfully fetched scheduled posts',
            scheduledPosts,
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
const reloadScheduledPosts = async () => {
    try {
        const scheduledPosts = await ImgurScheduledPost.find({});
        scheduledPosts.forEach((post) => {
            const job = schedule.scheduleJob(post.scheduleTime, async () => {
                try {
                    console.log('executing scheduled job:', post.jobId);
                    await publishToImgur(post.title, post.files.map(file => file.imageHash), post.files.map(file => file.description), post.tags, post.topic);
                    console.log('Successfully posted to Imgur using scheduled job:', post.jobId);
                    await ImgurScheduledPost.deleteOne({ jobId: post.jobId });
                } catch (e) {
                    console.error('Error posting to Imgur using scheduled job:', e.response?.data || e.message);
                }
            })
        });
        console.log('Successfully reloaded scheduled posts');
    } catch (e) {
        console.error('Error reloading scheduled posts:', e);
    }
}

module.exports = {
    postToImgur,
    getScheduledPosts,
    reloadScheduledPosts,
    deleteScheduledPost,
};