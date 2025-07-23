const axios = require('axios');

const APP_CLIENT_ID = process.env.REACT_APP_CLIENT_ID;
const APP_CLIENT_SECRET = process.env.REACT_APP_CLIENT_SECRET;

const facebookAuthStore = {
    status: null,
    isvalid: null,
    message: null,
    timestamp: null,
    tokens: {
        userId: null,
        accessToken: null,
        expiresIn: null,
    }
}

const updateAuthStatus = (status, isvalid, message, userId, accessToken, expiresIn) => {
    facebookAuthStore.status = status;
    facebookAuthStore.isvalid = isvalid;
    facebookAuthStore.message = message;
    facebookAuthStore.timestamp = new Date().toISOString();
    facebookAuthStore.tokens.userId = userId;
    facebookAuthStore.tokens.accessToken = accessToken;
    facebookAuthStore.tokens.expiresIn = expiresIn;
}

const validateTokenHelper = async (data) => {
    const { accessToken } = data;
    try {
        const response = await axios.get(`https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${APP_CLIENT_ID}|${APP_CLIENT_SECRET}`);
        if (response.data && response.data.data && response.data.data.is_valid) {
            console.log('Token is valid');
            return true;
        } else {
            console.log('Token is invalid');
            return false;
        }
    } catch (error) {
        console.error('Error validating token:', error);
        return false;
    }
};

module.exports = {
    facebookAuthStore,
    updateAuthStatus,
    validateTokenHelper
};