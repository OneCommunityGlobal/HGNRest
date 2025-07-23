const express = require('express');
const router = express.Router();
const axios = require('axios');
const authStore = require('../services/auth');


const disconnectFacebook = async (req, res) => {
    try {
        authStore.updateAuthStatus('disconnected', false, 'Disconnected from Facebook', null, null, null);
        
        console.log('Disconnecting user - Session before logout:', req.session);
        
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).json({
                    status: 'error',
                    message: 'Error during logout'
                });
            }
            
            res.clearCookie('connect.sid', {
                path: '/',
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: false 
            });
            
            console.log('User logged out successfully, session destroyed');
            
            res.status(200).json({
                status: 'success',
                message: 'Disconnected from Facebook'
            });
        });
    } catch (error) {
        console.error('Error in disconnectFacebook:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error during logout'
        });
    }
};

const facebookAuthCallback = async (req, res) => {
    console.log('Facebook auth callback called');
    try {
        const { data } = req.body;
        if (!data) {
            return res.status(400).json({
                status: 'error',
                message: 'No data received'
            });
        }

        // Validate the token using the helper function
        const isValid = await authStore.validateTokenHelper(data);
        if (!isValid) {
            return res.status(401).json({
                status: 'error',
                message: 'Invalid token'
            });
        }

        const fbExpiresInSeconds = data.expiresIn;
        
        const fbExpiresInMs = fbExpiresInSeconds * 1000;
        
        const sessionMaxAge = 24 * 60 * 60 * 1000;
        
        const cookieMaxAge = Math.min(fbExpiresInMs, sessionMaxAge);

        req.session.cookie.maxAge = cookieMaxAge;
        
        const expirationTimestamp = new Date(Date.now() + cookieMaxAge);

        // Update the auth status
        await authStore.updateAuthStatus('connected', true, 'Facebook authentication successful', data.userID, data.accessToken, data.expiresIn);

        req.session.user = {
            userId: data.userID,
            isAuthenticated: true,
            provider: 'facebook',
            tokenExpiresAt: expirationTimestamp.toISOString(),
            accessToken: data.accessToken,
        }

        console.log('facebook access token:', data.accessToken);

        req.session.save((err) => {
            if (err) {
                console.error('Error saving session:', err);
                return res.status(500).json({
                    status: 'error',
                    message: 'Internal server error while saving session'
                });
            }
            res.status(200).json({
                status: 'success',
                message: 'Facebook authentication successful!',
                data: {
                    status: authStore.facebookAuthStore.status,
                    isvalid: authStore.facebookAuthStore.isvalid,
                    message: authStore.facebookAuthStore.message,
                    timestamp: authStore.facebookAuthStore.timestamp,
                    userId: authStore.facebookAuthStore.tokens.userId,
                    expiresIn: authStore.facebookAuthStore.tokens.expiresIn,
                }
            });
        })
        
    } catch (error) {
        console.error('Error in Facebook auth callback:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
}

const getFacebookAuthStatus = (req, res) => {
    if (req.session && req.session.user && req.session.user.isAuthenticated) {
        return res.status(200).json({
            status: 'success',
            message: 'Facebook authentication status retrieved successfully',
            data: {
                status: 'connected',
                isvalid: true,
                userId: req.session.user.userId,
                provider: req.session.user.provider,
                tokenExpiresAt: req.session.user.tokenExpiresAt,
            }
        });
    } else {
        return res.status(200).json({
            status: 'success',
            message: 'Not authenticated with Facebook',
            data: {
                status: 'disconnected',
                isvalid: false
            }
        });
    }
}

const threadsLogin = async (req, res) => {
    /*
    https://www.threads.net/oauth/authorize?
  client_id=1030521445884791
  &redirect_uri=https://d41d-52-119-103-2.ngrok-free.app/api/auth/threads/callback
  &scope=threads_basic,threads_content_publish
  &response_type=code

    */
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

const getThreadsAccessTokenHelper = async (code) => {
    try {
        const formData = new URLSearchParams();
        formData.append('client_id', process.env.REACT_APP_THREADS_ID);
        formData.append('client_secret', process.env.REACT_APP_THREADS_SECRET);
        formData.append('redirect_uri', process.env.REACT_APP_THREADS_REDIRECT_URI);
        formData.append('code', code);
        formData.append('grant_type', 'authorization_code');
        const response = await axios.post('https://graph.threads.net/oauth/access_token', formData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (response.status === 200) {
            return {
                status: 'success',
                data: response.data
            };
        } else {
            return {
                status: 'error',
                message: 'Failed to retrieve access token from Threads'
            };
        }
    } catch (error) {
        console.error('Error retrieving Threads access token:', error);
        return {
            status: 'error',
            message: 'Internal server error while retrieving Threads access token'
        };
    }
}

const threadsAuthCallback = async (req, res) => {
    console.log('Threads auth callback called');
    try {
        const { code } = req.query;
        if (!code) {
            console.error('No authorization code received from Threads');
            return res.status(400).json({
                status: 'error',
                message: 'No authorization code received'
            });
        }
        console.log('Received Threads authorization code:', code);

        const tokenResponse = await getThreadsAccessTokenHelper(code);
        if (tokenResponse.status === 'error') {
            console.error('Error retrieving Threads access token:', tokenResponse.message);
            return res.status(500).json({
                status: 'error',
                message: tokenResponse.message
            });
        }

        console.log('Threads access token response:', tokenResponse.data);

        res.status(200).send(`
        <html>
            <head><title>Threads Authentication Successful</title></head>
            <body>
            <h3>Threads Authentication Successful! You can close this window.</h3>
            <script>
                if (window.opener) {
                window.opener.postMessage({ status: 'success', provider: 'threads', userId: '${tokenResponse.data.user_id}', accessToken: '${tokenResponse.data.access_token}' }, '*');
                window.close();
                }
            </script>
            </body>
        </html>
        `);
    } catch (error) {
        console.error('Error in Threads auth callback:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
}


    

// Export the router
module.exports = {
    facebookAuthCallback,
    disconnectFacebook,
    getFacebookAuthStatus,
    threadsAuthCallback,
    threadsLogin
};