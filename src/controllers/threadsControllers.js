const express = require('express');
const router = express.Router();
const axios = require('axios');
const authStore = require('../services/auth');

const threadsLogin = async (req, res) => {
    const url = `https://threads.net/oauth/authorize?client_id=${process.env.REACT_APP_THREADS_ID}&redirect_uri=${process.env.REACT_APP_THREADS_REDIRECT_URI}&scope=${process.env.REACT_APP_THREADS_SCOPE}&response_type=code`; 
    try {
        res.status(200).json({
            status: 'success',
            message: 'Redirecting to Threads login',
            data: {
                url: url
            }
        });
    } catch (error) {
        console.error('Error in threadsLogin:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
}

const updateSessionWithThreadsData = (req, res) => {
    const threadsData = req.body;
    console.log('Updating session with Threads data:', threadsData);
    if (!threadsData || !threadsData.data.userId || !threadsData.data.accessToken) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid Threads data'
        });
    }
    req.session.user.threads = { 
        userId: threadsData.data.userId,
        accessToken: threadsData.data.accessToken,
        isAuthenticated: true,
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
    };

    req.session.save((err) => {
        if (err) {
            console.error('Error saving session:', err);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to update session'
            });
        }
        res.status(200).json({
            status: 'success',
            message: 'Session updated with Threads data',
        });
    })


}

const getThreadsAccount = async (req, res) => {
    try {
        const accessToken = req.session.user.threads.accessToken;
        if (!accessToken) {
            return res.status(401).json({
                status: 'error',
                message: 'No access token found'
            });
        }

        const accountData = await axios.get('https://graph.threads.net/v1.0/me', {
            params: {
                fields: 'id,username,name,threads_profile_picture_url',
                access_token: accessToken
            }
        });
        if (!accountData || !accountData.data) {
            return res.status(404).json({
                status: 'error',
                message: 'Threads account not found'
            });
        }
        console.log('Threads account data:', accountData.data);
        return res.status(200).json({
            status: 'success',
            data: accountData.data
        });
    } catch (error) {
        console.error('Error fetching Threads account:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to fetch Threads account'
        });
    }
}

const createImageContainerHelper = async (id, imageUrl, text, accessToken) => {
    console.log('Creating image container for Threads post...');
    try {
        const url = `https://graph.threads.net/v1.0/${id}/threads?media_type=IMAGE&image_url=${imageUrl}&text=${text}&access_token=${accessToken}`;
        const response = await axios.post(url);
        console.log('Container created successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error creating Threads container:', error);
        return null;
    }
}

const createLinkContainerHelper = async (id, linkAttachment, text, accessToken) => {
    console.log('Creating link container for Threads post...');
    try {
        const body = new URLSearchParams();
        body.append('link_attachment', linkAttachment);
        const url = `https://graph.threads.net/v1.0/${id}/threads?media_type=TEXT&text=${text}&access_token=${accessToken}`;
        const response = await axios.post(url, body);
        console.log('Container created successfully:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error creating Threads container:', error);
        return null;
    }
}

const postToThreads = async (req, res) => {
    console.log('Posting image to Threads...');

    try {
        const { data, text, type } = req.body;
        const accessToken = req.session.user.threads.accessToken;
        if (!accessToken) {
            return res.status(401).json({
                status: 'error',
                message: 'No access token found'
            });
        }

        const threadsId = req.session.user.threads.userId;
        if (!threadsId) {
            return res.status(400).json({
                status: 'error',
                message: 'Threads ID is required'
            });
        }

        let container;
        if (type === 'IMAGE') {
            container = await createImageContainerHelper(threadsId, data, text, accessToken);
            if (!container) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to create image container'
                });
            }
        } else if (type === 'LINK') {
            container = await createLinkContainerHelper(threadsId, data, text, accessToken);
            if (!container) {
                return res.status(500).json({
                    status: 'error',
                    message: 'Failed to create link container'
                });
            }
        }
        const response = await axios.post(`https://graph.threads.net/v1.0/${threadsId}/threads_publish?creation_id=${container.id}&access_token=${accessToken}`);
        if (!response || !response.data) {
            return res.status(500).json({
                status: 'error',
                message: 'Failed to publish Threads post'
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Post created successfully'
        });
    } catch (error) {
        console.error('Error posting to Threads:', error);
        if (error.response) {
            console.error('API error response:', error.response.data);
            return res.status(error.response.status).json({
                status: 'error',
                message: 'Error from Threads API',
                error: error.response.data
            });
        }
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to post to Threads',
            error: error.message
        });
    }
}


module.exports = {
    threadsLogin,
    updateSessionWithThreadsData,
    getThreadsAccount,
    postToThreads
};
