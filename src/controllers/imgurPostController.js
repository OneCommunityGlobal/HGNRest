// const fs = require('fs');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require ('dotenv').config();
const FormData = require('form-data');
const schedule = require('node-schedule');
const ImgurScheduledPost = require('../models/imgurPosts');

const crypto = require('crypto');

const imgurClientId = process.env.REACT_APP_IMGUR_CLIENT_ID2;
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
        accountUsername: null,
        accountId: null,
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
            expiresAt: null,
            accountUsername: null,
            accountId: null
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
    const authUrl = `https://api.imgur.com/oauth2/authorize?client_id=${imgurClientId}&response_type=token`;
    
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

const handleImgurAuthCallback = async (req, res) => {
    console.log('Imgur auth callback received');
    
    // Create an HTML page that extracts tokens from the fragment and sends them back to server
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Imgur Authentication</title>
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
            .message { font-size: 18px; margin: 20px; }
            .success { color: green; }
            .error { color: red; }
            .redirecting { font-size: 14px; margin-top: 30px; color: #666; }
        </style>
    </head>
    <body>
        <h2>Imgur Authentication</h2>
        <div id="status" class="message">Processing your authentication...</div>
        <div id="redirecting" class="redirecting"></div>
        
        <script>
            // Extract tokens from URL fragment
            const fragment = window.location.hash.substring(1);
            const params = new URLSearchParams(fragment);
            
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            const expiresIn = params.get('expires_in');
            const accountUsername = params.get('account_username');
            const accountId = params.get('account_id');
            
            if (!accessToken || !refreshToken) {
                document.getElementById('status').className = 'message error';
                document.getElementById('status').textContent = 'Authentication failed. Missing required tokens.';
                throw new Error('Authentication failed. Missing required tokens.');
            }
            
            // Use relative URL path instead of hardcoded domain
            
            axios.post('http://localhost:4500/api/imgur/store-token', {
                accessToken,
                refreshToken,
                expiresIn,
                accountUsername,
                accountId
            })
            .then(response => {
                if (response.data.success) {
                    document.getElementById('status').className = 'message success';
                    document.getElementById('status').textContent = 'Authentication successful!';
                    document.getElementById('redirecting').textContent = 'Closing in 2 seconds...';
                    setTimeout(() => window.close(), 2000);
                } else {
                    document.getElementById('status').className = 'message error';
                    document.getElementById('status').textContent = 'Authentication failed: ' + response.data.message;
                }
            })
            .catch(error => {
                document.getElementById('status').className = 'message error';
                document.getElementById('status').textContent = 'Authentication error: ' + 
                    (error.response?.data?.message || error.message);
            });
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
};


const storeImgurToken = async (req, res) => {
    try {
        console.log('Received request to store Imgur token:', req.body);
        
        const { accessToken, refreshToken, expiresIn, accountUsername, accountId } = req.body;
        
        if (!accessToken || !refreshToken) {
            console.warn('Missing required tokens in request');
            return res.status(400).json({
                success: false,
                message: 'Access token and refresh token are required'
            });
        }
        
        // Calculate expiration time
        const expiresAt = Date.now() + (parseInt(expiresIn, 10) * 1000); 
        
        // Store tokens in your auth store
        updateAuthStatus('success', 'Successfully authenticated with Imgur', {
            accessToken,
            refreshToken,
            expiresAt,
            accountUsername,
            accountId
        });
        
        console.log('Successfully stored Imgur tokens for user:', accountUsername);
        
        return res.json({
            success: true,
            message: 'Imgur tokens stored successfully'
        });
    } catch (error) {
        console.error('Error in storeImgurToken:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while storing Imgur tokens',
            error: error.message
        });
    }
};

const getImgurAuthStatus = async (req, res) => res.json({
    success: imgurAuthStore.status === 'success',
    status: imgurAuthStore.status || 'unknown',
    message: imgurAuthStore.message || 'No status available',
    timestamp: imgurAuthStore.timestamp || null,
    data: imgurAuthStore.status === 'success' ? {
        accountId: imgurAuthStore.tokens.accountId,
        accountUsername: imgurAuthStore.tokens.accountUsername,
        hasValidToken: !!imgurAuthStore.tokens.accessToken,
        expiresAt: imgurAuthStore.tokens.expiresAt,
    } : null,
});

const refreshImgurToken = async (req, res) => {
    try {
        const { refreshToken } = imgurAuthStore.tokens;
        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Imgur refresh token is missing or expired'
            });
        }

        const response = await axios.post('https://api.imgur.com/oauth2/token', {
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: imgurClientId,
            client_secret: imgurClientSecret,
        });

        const { access_token, expires_in } = response.data;
        const expiresAt = Date.now() + (parseInt(expires_in, 10) * 1000);

        imgurAuthStore.tokens.accessToken = access_token;
        imgurAuthStore.tokens.expiresAt = expiresAt;

        updateAuthStatus('success', 'Successfully refreshed Imgur token');

        return res.json({
            success: true,
            message: 'Imgur token refreshed successfully',
        });
        
    } catch (error) {
        console.error('Error refreshing Imgur token:', error);
        return res.status(500).json({
            success: false,
            message: 'Error refreshing Imgur token',
            error: error.message
        });
    }
}

const uploadImage = async (req, res) => {
    console.log('Received request to upload image:', req.file);
    try {
        const image = req.file;
        const title = req.body.title;
        const description = req.body.description;

        if (!image || !description) {
            return res.status(400).json({
                success: false,
                message: 'No image file or description provided'
            });
        }

        const accessToken = imgurAuthStore.tokens.accessToken;

        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: 'Imgur access token is missing or expired'
            });
        }

        const formData = new FormData();
        formData.append('image', image.buffer, image.originalname);
        formData.append('type', 'file');
        formData.append('title', title);
        formData.append('description', description);

    
        const response = await axios.post('https://api.imgur.com/3/image', 
            formData, 
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'multipart/form-data',
                },
            }
        );

        return res.json({
            success: true,
            message: 'Image uploaded successfully',
            data: response.data
        });
    } catch (error) {
        console.error('Error uploading image to Imgur:', error);
        return res.status(500).json({
            success: false,
            message: 'Error uploading image to Imgur',
            error: error.message
        });
    }
}

const uploadImageToGallery = async (req, res) => {
    console.log('Received request to upload image to gallery');
    try {
        const { imageHash } = req.params;
        const { title, topic, tags } = req.body;

        if (!imageHash || !title || !topic || !tags) {
            return res.status(400).json({
                success: false,
                message: 'No image hash, title, topic, or tags provided'
            });
        }

        const accessToken = imgurAuthStore.tokens.accessToken;
        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: 'Imgur access token is missing or expired'
            });
        } 

        const response = await axios.post(`https://api.imgur.com/3/gallery/image/${imageHash}`, {
            title,
            topic,
            terms: 1,
            tags
        }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            }
            
        });

        return res.json({
            success: true,
            message: 'Image uploaded to gallery successfully',
            data: response.data
        });
    } catch (error) {
        console.error('Error uploading image to gallery on Imgur:', error);
        return res.status(500).json({
            success: false,
            message: 'Error uploading image to gallery on Imgur',
            error: error.message
        });
    }
}

const uploadImageToGalleryHelper = async (imageHash, title, topic, tags) => {
    try {
        const accessToken = imgurAuthStore.tokens.accessToken;
        if (!accessToken) {
            throw new Error('Imgur access token is missing or expired');
            return;
        }

        const response = await axios.post(`https://api.imgur.com/3/gallery/image/${imageHash}`, {
            title,
            topic,
            terms: 1,
            tags
        }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            }
            
        });

        return response.data;
    } catch (error) {
        console.error('Error uploading image to gallery on Imgur:', error);
        throw error;
    }
}

const publishScheduledPost = async (jobId) => {
    try {
        const post = await ImgurScheduledPost.findOne({ jobId });
        if (!post) {
            throw new Error('Scheduled post not found');
        }

        const accessToken = imgurAuthStore.tokens.accessToken;
        if (!accessToken) {
            throw new Error('Imgur access token is missing or expired');
        }

        const { imageHash, title, tags, topic } = post;
        const postResponse = await uploadImageToGalleryHelper(imageHash, title, topic, tags);

        if (postResponse) {
            console.log('Successfully posted to Imgur gallery:', postResponse);
        } else {
            throw new Error('Failed to post to Imgur gallery');
        }
        await ImgurScheduledPost.findOneAndUpdate(
            { jobId },
            { status: 'published' }
        );
    } catch (error) {
        console.error('Error publishing scheduled post:', error);
        throw new Error('Error publishing scheduled post');
    }
}

const scheduledJobs = new Map();

const scheduleImgurPostHelper = async (jobId, scheduledTime) => {
    const job = schedule.scheduleJob(new Date(scheduledTime), async () => {
        try {
            await publishScheduledPost(jobId);
            scheduledJobs.delete(jobId);
        } catch (error) {
            console.error('Error executing scheduled job:', error);
            await ImgurScheduledPost.findOneAndUpdate(
                { jobId },
                { status: 'failed' }
            );
        }
    });

    scheduledJobs.set(jobId, job);
}

const getImageInfoHelper = async (imageHash) => {
    try {
        const accessToken = imgurAuthStore.tokens.accessToken;
        if (!accessToken) {
            throw new Error('Imgur access token is missing or expired');
        }

        const response = await axios.get(`https://api.imgur.com/3/image/${imageHash}`, {
            headers: {
                Authorization: `Client-ID ${imgurClientId}`,
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error getting image info from Imgur:', error);
        throw new Error('Error getting image info from Imgur');
    }
}

const scheduleImgurPost = async (req, res) => {
    try {
        const { imageHash, tags, topic, scheduledTime } = req.body;

        if (!imageHash || !tags || !topic || !scheduledTime) {
            return res.status(400).json({
                success: false,
                message: 'No image hash, tags, topic, or scheduled time provided'
            });
        }

        const imageInfo = await getImageInfoHelper(imageHash);
        if (!imageInfo) {
            return res.status(404).json({
                success: false,
                message: 'Image not found on Imgur'
            });
        }

        const imageUrl = imageInfo.data.link;
        const title = imageInfo.data.title;
        const description = imageInfo.data.description;
        
        const jobId = crypto.randomUUID();
        const scheduledPost = await ImgurScheduledPost.create({
            jobId,
            imageHash,
            imageUrl,
            title,
            description,
            tags,
            topic,
            scheduledTime: new Date(scheduledTime),
            status: 'scheduled'
        })

        await scheduleImgurPostHelper(jobId, scheduledTime);
        return res.json({
            success: true,
            message: 'Scheduled post created successfully',
            data: scheduledPost
        });
    } catch (error) {
        console.error('Error scheduling post:', error);
        return res.status(500).json({
            success: false,
            message: 'Error scheduling post',
            error: error.message
        });
    }
}

const deleteImage = async (req, res) => {
    try {
        const { deleteHash } = req.params;
        if (!deleteHash) {
            return res.status(400).json({
                success: false,
                message: 'No delete hash provided'
            });
        }

        const accessToken = imgurAuthStore.tokens.accessToken;
        if (!accessToken) {
            return res.status(401).json({
                success: false,
                message: 'Imgur access token is missing or expired'
            });
        }

        const response = await axios.delete(`https://api.imgur.com/3/image/${deleteHash}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            }
        });

        return res.json({
            success: true,
            message: 'Image deleted successfully',
            data: response.data
        });
    } catch (error) {
        console.error('Error deleting image from Imgur:', error);
        return res.status(500).json({
            success: false,
            message: 'Error deleting image from Imgur',
            error: error.message
        });
    }
}

const getImgurScheduledPosts = async (req, res) => {
    try {
        const posts = await ImgurScheduledPost.find();
        return res.json({
            success: true,
            message: 'Scheduled posts retrieved successfully',
            posts
        });
    } catch (error) {
        console.error('Error retrieving scheduled posts:', error);
        return res.status(500).json({
            success: false,
            message: 'Error retrieving scheduled posts',
            error: error.message
        });
    }
}

// const uploadImageToImgur = async (file, ACCESS_TOKEN) => {
//     const formData = new FormData();
//     formData.append('image', file.buffer, file.originalname);
//     formData.append('type', 'file');
//     formData.append('title', `${file.originalname}`);
//     formData.append('description', `${file.description}`);

//     try {
//         const response = await axios.post('https://api.imgur.com/3/image', formData, {
//             headers: {
//                 Authorization: `Bearer ${ACCESS_TOKEN}`,
//                 'Content-Type': 'multipart/form-data',
//             },
//         });

//         return response.data.data.id;
//     } catch (e) {
//         console.error('Error uploading image to Imgur:', e.response?.data || e.message);
//         throw new Error('Error uploading image to Imgur');
//     }
// }

// const deleteImageFromImgur = async (imageHash) => {
//     const ACCESS_TOKEN = await getImgurAccessToken();
//     try {
//         const response = await axios.delete(`https://api.imgur.com/3/image/${imageHash}`, {
//             headers: {
//                 Authorization: `Bearer ${ACCESS_TOKEN}`,
//             },
//         });
//     } catch (e) {
//         console.error('Error deleting image from Imgur:', e.response?.data || e.message);
//     }
// };

// const deleteAlbumFromImgur = async (albumHash, ACCESS_TOKEN) => {
//     try {
//         const response = await axios.delete(`https://api.imgur.com/3/album/${albumHash}`, {
//             headers: {
//                 Authorization: `Bearer ${ACCESS_TOKEN}`,
//             },
//         });
//     } catch (e) {
//         console.error('Error deleting album from Imgur:', e.response?.data || e.message);
//     }
// }

// const deleteScheduledPost = async (req, res) => {
//     try {
//         const { jobId } = req.params;
//         const post = await ImgurScheduledPost.findOne({ jobId });

//         if (!post) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Scheduled post not found',
//             });
//         }


//         // delete images from imgur
//         post.files.forEach(async (file) => {
//             await deleteImageFromImgur(file.imageHash);
//         });
        
//         await ImgurScheduledPost.deleteOne({ jobId });

//         res.status(200).json({
//             success: true,
//             message: 'Successfully deleted scheduled post',
//             jobId,
//         });
//     } catch (e) {
//         console.error('Error deleting scheduled post:', e);
//         res.status(e.response?.status || 500).json({
//             success: false,
//             message: e.response?.data?.message || 'Failed to delete scheduled post',
//             error: e.response?.data || e.message,
//         });
//     }
// }


// const createImgurAlbum = async(title, description) => {
//     const ACCESS_TOKEN = await getImgurAccessToken();
//     try {
//         const response = await axios.post('https://api.imgur.com/3/album', {
//             title,
//             description,
//             privacy: 'hidden',
//         }, {
//             headers: {
//                 Authorization: `Bearer ${ACCESS_TOKEN}`,
//             },
//         });

//         return response.data.data.id;
//     } catch (e) {
//         console.error('Error creating album on Imgur:', e.response?.data || e.message);
//         throw new Error('Error creating album on Imgur');
//     }
// }

// const uploadImagesToAlbum = async (imageHashes, albumHash) => {
//     const ACCESS_TOKEN = await getImgurAccessToken();
//     const formData = new FormData();
//     imageHashes.forEach((imageHash) => {
//         formData.append('ids', imageHash);
//     })

//     try {
//         const response = await axios.post(`https://api.imgur.com/3/album/${albumHash}/add`, formData, {
//             headers: {
//                 Authorization: `Bearer ${ACCESS_TOKEN}`,
//                 'Content-Type': 'multipart/form-data',
//             },
//         })

//         return response.data;
//     } catch (e) {
//         console.error('Error uploading images to album:', e.response?.data || e.message);
//         imageHashes.forEach(async (imageHash) => {
//             await deleteImageFromImgur(imageHash, ACCESS_TOKEN);
//         });
//         throw new Error('Error uploading images to album');
//     }
// }

// const postAlbumToGallery = async (albumHash, title, tags, topic) => {
//     const ACCESS_TOKEN = await getImgurAccessToken();
//     try {
//         const response = await axios.post(`https://api.imgur.com/3/gallery/album/${albumHash}`, {
//             title,
//             topic,
//             terms: 1,
//             tags,
//         }, {
//             headers: {
//                 Authorization: `Bearer ${ACCESS_TOKEN}`,
//             },
//         });

//         return response.data;
//     } catch (e) {
//         console.error('Error posting album to gallery:', e.response?.data || e.message);
//         throw new Error('Error posting album to gallery');
//     }
// }

// const getImageHashes = async (files) => {
//     const ACCESS_TOKEN = await getImgurAccessToken();
    
//     const imageHashes = await Promise.all(files.map(async (file) => {
//         try {
//             const imageHash = await uploadImageToImgur(file, ACCESS_TOKEN);
//             return imageHash;
//         } catch (e) {
//             console.error('Error getting image hashes:', e.response?.data || e.message);
//             return null;
//         }
//     }));


//     return imageHashes.filter((imageHash) => imageHash !== null);

// }

// const publishToImgur = async (title, imageHashes, description, tags, topic) => {
//     try {
//         // create imgur album
//         const albumHash = await createImgurAlbum(title, 'weekly report');

//         // upload images to imgur album with image hashes
//         await uploadImagesToAlbum(imageHashes, albumHash);

//         // post album to gallery
//         const result = await postAlbumToGallery(albumHash, title, tags, topic);

//     } catch (e) {
//         console.error('Error posting to Imgur:', e.response?.data || e.message);
//         throw new Error('Error posting to Imgur');
//     }
// }


// const postToImgur = async (req, res) => {
    
//     try {

//         const { title, description, tags, topic, scheduleTime } = req.body;

//         if (!req.files) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Missing image',
//             });
//         }

//         if (!title) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Missing title',
//             });
//         }

//         let descriptions;
//         if (Array.isArray(description)) {
//             descriptions = description;
//         } else if (description) {
//             descriptions = [description];
//         } else {
//             descriptions = [];
//         }
        
//         if (descriptions.length !== req.files.length) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'The number of descriptions does not match the number of uploaded files',
//             });
//         }
        
//         if (scheduleTime) {
//             let { IMGUR_SCHEDULED_POSTS_ALBUM_HASH } = process.env;

//             if (!IMGUR_SCHEDULED_POSTS_ALBUM_HASH || IMGUR_SCHEDULED_POSTS_ALBUM_HASH === undefined) {
//                 const scheduledPostsAlbumHash = await createImgurAlbum('Scheduled Posts', 'Scheduled posts album');
//                 updateEnvFile('IMGUR_SCHEDULED_POSTS_ALBUM_HASH', scheduledPostsAlbumHash);
//                 IMGUR_SCHEDULED_POSTS_ALBUM_HASH = scheduledPostsAlbumHash;
//                 require('dotenv').config();
//             }

//             const scheduledDateTime = new Date(scheduleTime);
            
//             if (scheduledDateTime <= new Date()) {
//                 return res.status(400).json({
//                     success: false,
//                     message: 'Invalid schedule time',
//                 });
//             }

//             // upload images to scheduled posts album in imgur
//             const imageHashes = await getImageHashes(req.files);

//             await uploadImagesToAlbum(imageHashes, IMGUR_SCHEDULED_POSTS_ALBUM_HASH);

            

//             const jobId = `imgur-post-${Date.now()}`;
//             const job = schedule.scheduleJob(scheduledDateTime, async () => {
//                 try {
//                     await publishToImgur(title, imageHashes, description, tags, topic);
//                     await ImgurScheduledPost.deleteOne({ jobId });
//                 } catch (e) {
//                     console.error('Error posting to Imgur using scheduled job:', e.response?.data || e.message);
//                 }
//             })

//             // upload to database to preserve scheduled posts if server crashes or restarts
//             const newScheduledPost = new ImgurScheduledPost({
//                 jobId,
//                 title,
//                 tags,
//                 topic,
//                 files: imageHashes?.map(( hash, index ) => ({
//                     imageHash: hash,
//                     originalName: req.files[index].originalname,
//                     description: description[index],
//                 })),
//                 scheduleTime: scheduledDateTime,
//             });

//             await newScheduledPost.save();

//             return res.status(200).json({
//                 success: true,
//                 message: 'Successfully scheduled post',
//                 jobId,
//                 newScheduledPost,
//                 scheduledTime: scheduledDateTime,
//             });
//         } 
        
//         const imageHashes = await getImageHashes(req.files);
//         await publishToImgur(title, imageHashes, description, tags, topic);

//         res.status(200).json({
//             success: true,
//             message: 'Successfully posted to Imgur',
//         });

//     } catch (e) {
//         console.error('Error posting to Imgur in postToImgur:', e);
//         // delete images from imgur if post fails
//         req.files.forEach(async (file) => {
//             await deleteImageFromImgur(file.imageHash);
//         });
//         res.status(e.response?.status || 500).json({
//             success: false,
//             message: e.response?.data?.message || 'Failed to post to Imgur',
//             error: e.response?.data || e.message,
//         });
//     }
// }

module.exports = {
    // postToImgur,
    // getScheduledPosts,
    // reloadScheduledPosts,
    // deleteScheduledPost,
    // authImgur,

    getImgurAuthUrl,
    handleImgurAuthCallback,
    storeImgurToken,
    disconnectImgur,
    getImgurAuthStatus,
    refreshImgurToken,

    uploadImage,
    uploadImageToGallery,
    deleteImage,

    scheduleImgurPost,
    getImgurScheduledPosts
};