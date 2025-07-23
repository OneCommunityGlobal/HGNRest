const express = require('express');
const router = express.Router();
const axios = require('axios');
const authStore = require('../services/auth');

const getPages = async (req, res) => {
    console.log(`Fetching pages for user...`);
    try {
        const accessToken = req.session.user.accessToken;
        if (!accessToken) {
            return res.status(401).json({
                status: 'error',
                message: 'No access token found'
            });
        }

        const response = await axios.get(`https://graph.facebook.com/v23.0/me/accounts?fields=name,access_token,tasks,instagram_business_account&access_token=${accessToken}`);
        const pages = response.data.data;

        req.session.user.pages = pages.map(page => ({
            id: page.id,
            name: page.name,
            accessToken: page.access_token,
            tasks: page.tasks,
            instagramBusinessAccount: page.instagram_business_account? page.instagram_business_account.id : null
        }));

        res.status(200).json({
            status: 'success',
            data: pages
        });
    } catch (error) {
        console.error('Error fetching pages:', error);
        if (error.response) {
            console.error('API error response:', error.response.data);
            return res.status(error.response.status).json({
                status: 'error',
                message: 'Error from Facebook API',
                error: error.response.data
            });
        }
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch pages',
            error: error.message
        });
    }
}

const postLinkToPages = async (req, res) => {
    console.log('Posting link to pages...');
    try {
        const pageId = req.params.pageId;
        if (!pageId) {
            return res.status(400).json({
                status: 'error',
                message: 'Page ID is required'
            });
        }

        const { message, link, imageUrl } = req.body;
        if (link && imageUrl) {
            return res.status(400).json({
                status: 'error',
                message: 'Cannot provide both link and imageUrl. Choose one type of post.'
            });
        }

        const accessToken = req.session.user.accessToken;
        if (!accessToken) {
            return res.status(401).json({
                status: 'error',
                message: 'No access token found'
            });
        }

        const page = req.session.user.pages.find(p => p.id === pageId);
        if (!page) {
            return res.status(404).json({
                status: 'error',
                message: 'Page not found or you do not have permission'
            });
        }

        const pageAccessToken = page.accessToken;
        if (!pageAccessToken) {
            return res.status(403).json({
                status: 'error',
                message: 'No access token for the specified page'
            });
        }

        const params = {
            access_token: pageAccessToken,
            published: true,
            message: message,
            link: link,
        }

        const response = await axios.post(`https://graph.facebook.com/v23.0/${pageId}/feed`, {
            ...params 
        });

        if (response.status !== 200) {
            return res.status(response.status).json({
                status: 'error',
                message: 'Failed to post to page',
                error: response.data
            });
        }

        console.log('Post successful:', response);

        return res.status(200).json({
            status: 'success',
            message: 'Post to pages successful',
        })


    } catch (error) {
        console.error('Error posting to pages:', error);
        
        return res.status(500).json({
            status: 'error',
            message: 'Failed to post to pages',
            error: error.response.data.error.message || 'Unknown error'
        });
    }
}

const postImageToPages = async (req, res) => {
    console.log('Posting image to pages...');
    try {
        const pageId = req.params.pageId;
        if (!pageId) {
            return res.status(400).json({
                status: 'error',
                message: 'Page ID is required'
            });
        }

        const { message, imageUrl } = req.body;
        console.log('Received body:', req.body);
        if (!imageUrl || !message) {
            return res.status(400).json({
                status: 'error',
                message: 'Both message and image URL are required'
            });
        }

        const page = req.session.user.pages.find(p => p.id === pageId);
        if (!page) {
            return res.status(404).json({
                status: 'error',
                message: 'Page not found or you do not have permission'
            });
        }

        const pageAccessToken = page.accessToken;
        if (!pageAccessToken) {
            return res.status(403).json({
                status: 'error',
                message: 'No access token for the specified page'
            });
        }

        const params = {
            access_token: pageAccessToken,
            published: true,
            message: message,
            url: imageUrl,
        }

        const response = await axios.post(`https://graph.facebook.com/v23.0/${pageId}/photos`, {
            ...params 
        });

        if (response.status !== 200) {
            return res.status(response.status).json({
                status: 'error',
                message: 'Failed to post to page',
                error: response.data
            });
        }

        console.log('Post successful:', response);

        return res.status(200).json({
            status: 'success',
            message: 'Post to pages successful',
        })
    } catch (error) {
        console.error('Error posting to pages:', error);
        
        return res.status(500).json({
            status: 'error',
            message: 'Failed to post to pages',
            error: error.response.data.error.message || 'Unknown error'
        });
    }
}

module.exports = {
    getPages,
    postLinkToPages,
    postImageToPages
}