const express = require('express');
const authStore = require('../services/auth');
const router = express.Router();

const formatDate = (date) => {
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true // This ensures time is in 12-hour format with AM/PM
    });
}

const logWithPadding = (label, value) => {
    const paddedLabel = (label + ':').padEnd(20, ' ');
    console.log(`${paddedLabel}${value}`);
};

const loggerStart = (req, res, next) => {
    const timestamp = new Date();
    const formattedDate = formatDate(timestamp);
    console.log(`================= [${formattedDate}] -- ${req.method} ${req.url} =================`);
    next();
}

const responseLogger = (req, res, next) => {
    const oldSend = res.send;
    res.send = function (data) {
        let responseData;
        try {
            if (typeof data === 'string' && data.trim().startsWith('{')) {
                const jsonData = JSON.parse(data);
                responseData = JSON.stringify(jsonData, null, 4);
            } else if (typeof data === 'object') {
                responseData = JSON.stringify(data, null, 4);
            } else {
                responseData = data;
            }
        } catch (error) {
            responseData = data;
        }
        
        logWithPadding('Response', '\n' + responseData);
        oldSend.apply(res, arguments);
    };
    next();
};

const cookieLogger = (req, res, next) => {
    if (req.cookies['connect.sid']) {
        logWithPadding('Session Cookie', `connect.sid=${req.cookies['connect.sid']}`);
    } else {
        logWithPadding('Session Cookie', 'Not found');
    }
    logWithPadding('Session ID', req.sessionID);
    logWithPadding('Session Data', JSON.stringify(req.session.user || {}, null, 2));
    next();
};

const isAuthenticated = (req, res, next) => {
    // These paths don't need authentication
    if (req.originalUrl === '/api/auth/facebook/callback' || 
        req.originalUrl === '/api/health' || 
        req.originalUrl === '/api/auth/facebook/status' ||
        req.originalUrl === '/api/debug-session') {
        logWithPadding('Auth Check', 'Skipped (public route)');
        return next();
    }

    if (req.session && req.session.user && req.session.user.isAuthenticated) {
        if (new Date(req.session.user.tokenExpiresAt) > new Date()) {
            logWithPadding('Auth Status', `Authenticated (User: ${req.session.user.userId})`);
            return next();
        }
        logWithPadding('Auth Status', `Session expired (User: ${req.session.user.userId})`);
        req.session.destroy((err) => {
            if (err) {
                logWithPadding('Error', `Destroying session: ${err.message}`);
            }
            logWithPadding('Auth Action', 'Session expired, user logged out');
            return res.status(401).json({
                status: 'error',
                message: 'Session expired'
            });
        });
    } else {
        // For unauthenticated users, send 401 for protected routes
        logWithPadding('Auth Status', 'Not authenticated');
        return res.status(401).json({
            status: 'error',
            message: 'Authentication required'
        });
    }
};

const verifyFacebookToken = async (req, res, next) => {
    if (!req.session || !req.session.user) {
        logWithPadding('Token Check', 'Skipped (no session)');
        return next();
    }
    
    // Check if we have a valid session with Facebook auth
    if (req.session.user.provider === 'facebook' && 
        req.session.user.isAuthenticated &&
        req.session.user.accessToken
    ) {
        logWithPadding('Token Check', 'Verifying Facebook token...');
        try {
            const isValid = await authStore.validateTokenHelper({ 
                accessToken: req.session.user.accessToken 
            });

            if (!isValid) {
                logWithPadding('Token Status', 'Expired or invalid');
                req.session.destroy();
                return res.status(401).json({
                    status: 'error',
                    message: 'Your Facebook session has expired. Please log in again.'
                });
            }
            logWithPadding('Token Status', 'Valid');
        } catch (error) {
            logWithPadding('Error', `Verifying token: ${error.message}`);
            return res.status(500).json({
                status: 'error',
                message: 'Internal server error while verifying Facebook token'
            });
        }
    } else {
        logWithPadding('Token Check', 'Skipped (not Facebook auth)');
    }
    
    next();
};

// Example middleware function for authentication
router.use((req, res, next) => {
    // Implement authentication logic here
    next();
});

module.exports = {
    loggerStart,
    responseLogger,
    isAuthenticated,
    cookieLogger,

    verifyFacebookToken
};