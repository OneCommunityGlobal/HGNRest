// const fs = require('fs');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require ('dotenv').config();
const FormData = require('form-data');
const schedule = require('node-schedule');
const ImgurScheduledPost = require('../models/imgurPosts');

const getImgurAccessToken = async () => {
    const {IMGUR_CLIENT_ID, IMGUR_CLIENT_SECRET, IMGUR_REFRESH_TOKEN, IMGUR_REDIRECT_URI} = process.env;

    if (!IMGUR_CLIENT_ID || !IMGUR_CLIENT_SECRET || !IMGUR_REDIRECT_URI) {
        throw new Error('IMGUR_CLIENT_ID, IMGUR_CLIENT_SECRET, and IMGUR_REDIRECT_URI must be set in the environment variables');
    }


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
        return response.data.access_token;
    } catch (e) {
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
    } catch (e) {
        console.error('Error deleting album from Imgur:', e.response?.data || e.message);
    }
}

const deleteScheduledPost = async (req, res) => {
    try {
        const { jobId } = req.params;
        const post = await ImgurScheduledPost.findOne({ jobId });

        if (!post) {
            return res.status(404).json({
                success: false,
                message: 'Scheduled post not found',
            });
        }


        // delete images from imgur
        post.files.forEach(async (file) => {
            await deleteImageFromImgur(file.imageHash);
        });
        
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

        return response.data;
    } catch (e) {
        console.error('Error posting album to gallery:', e.response?.data || e.message);
        throw new Error('Error posting album to gallery');
    }
}

const getImageHashes = async (files) => {
    const ACCESS_TOKEN = await getImgurAccessToken();
    
    const imageHashes = await Promise.all(files.map(async (file) => {
        try {
            const imageHash = await uploadImageToImgur(file, ACCESS_TOKEN);
            return imageHash;
        } catch (e) {
            console.error('Error getting image hashes:', e.response?.data || e.message);
            return null;
        }
    }));


    return imageHashes.filter((imageHash) => imageHash !== null);

}

const publishToImgur = async (title, imageHashes, description, tags, topic) => {
    try {
        // create imgur album
        const albumHash = await createImgurAlbum(title, 'weekly report');

        // upload images to imgur album with image hashes
        await uploadImagesToAlbum(imageHashes, albumHash);

        // post album to gallery
        const result = await postAlbumToGallery(albumHash, title, tags, topic);

    } catch (e) {
        console.error('Error posting to Imgur:', e.response?.data || e.message);
        throw new Error('Error posting to Imgur');
    }
}

const updateEnvFile = (key, value) => {
    const envPath = path.resolve(__dirname, '../../.env'); 
    const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const newEnvContent = envContent.includes(`${key}=`)
        ? envContent.replace(new RegExp(`${key}=.*`), `${key}=${value}`)
        : `${envContent}\n${key}=${value}`;
    fs.writeFileSync(envPath, newEnvContent, 'utf8');
}

const postToImgur = async (req, res) => {
    
    try {

        const { title, description, tags, topic, scheduleTime } = req.body;

        if (!req.files) {
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

        let descriptions;
        if (Array.isArray(description)) {
            descriptions = description;
        } else if (description) {
            descriptions = [description];
        } else {
            descriptions = [];
        }
        
        if (descriptions.length !== req.files.length) {
            return res.status(400).json({
                success: false,
                message: 'The number of descriptions does not match the number of uploaded files',
            });
        }
        
        if (scheduleTime) {
            let { IMGUR_SCHEDULED_POSTS_ALBUM_HASH } = process.env;

            if (!IMGUR_SCHEDULED_POSTS_ALBUM_HASH || IMGUR_SCHEDULED_POSTS_ALBUM_HASH === undefined) {
                const scheduledPostsAlbumHash = await createImgurAlbum('Scheduled Posts', 'Scheduled posts album');
                updateEnvFile('IMGUR_SCHEDULED_POSTS_ALBUM_HASH', scheduledPostsAlbumHash);
                IMGUR_SCHEDULED_POSTS_ALBUM_HASH = scheduledPostsAlbumHash;
                require('dotenv').config();
            }

            const scheduledDateTime = new Date(scheduleTime);
            
            if (scheduledDateTime <= new Date()) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid schedule time',
                });
            }

            // upload images to scheduled posts album in imgur
            const imageHashes = await getImageHashes(req.files);

            await uploadImagesToAlbum(imageHashes, IMGUR_SCHEDULED_POSTS_ALBUM_HASH);

            

            const jobId = `imgur-post-${Date.now()}`;
            const job = schedule.scheduleJob(scheduledDateTime, async () => {
                try {
                    await publishToImgur(title, imageHashes, description, tags, topic);
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

            return res.status(200).json({
                success: true,
                message: 'Successfully scheduled post',
                jobId,
                newScheduledPost,
                scheduledTime: scheduledDateTime,
            });
        } 
        
        const imageHashes = await getImageHashes(req.files);
        await publishToImgur(title, imageHashes, description, tags, topic);

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
                    await publishToImgur(post.title, post.files.map(file => file.imageHash), post.files.map(file => file.description), post.tags, post.topic);
                    await ImgurScheduledPost.deleteOne({ jobId: post.jobId });
                } catch (e) {
                    console.error('Error posting to Imgur using scheduled job:', e.response?.data || e.message);
                }
            })
        });
    } catch (e) {
        console.error('Error reloading scheduled posts:', e);
    }
}

module.exports = {
    postToImgur,
    getScheduledPosts,
    reloadScheduledPosts,
    deleteScheduledPost,
    // authImgur,
};