const { google } = require('googleapis');
const logger = require('../startup/logger');

if (
    process.env.NODE_ENV !== 'test' &&
    (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI)
) {
    logger.logException(new Error('Missing required OAuth configuration'), 'OAuth Config', {
        clientId: !!process.env.GOOGLE_CLIENT_ID,
        clientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: !!process.env.GOOGLE_REDIRECT_URI
    });
    throw new Error('Missing required OAuth configuration');
}

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

logger.logInfo('OAuth2 client configured with:', {
    clientId: process.env.GOOGLE_CLIENT_ID,
    redirectUri: process.env.GOOGLE_REDIRECT_URI
});

const blogger = google.blogger('v3');
let tokens = null;
let refreshToken = null;

function setTokens(newTokens) {
    tokens = newTokens;
    refreshToken = newTokens.refresh_token;
}

function getTokens() {
    return tokens;
}

module.exports = {
    oauth2Client,
    blogger,
    setTokens,
    getTokens
};
