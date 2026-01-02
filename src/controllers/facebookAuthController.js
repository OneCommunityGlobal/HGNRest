const axios = require('axios');
const FacebookConnection = require('../models/facebookConnections');
const { hasPermission } = require('../utilities/permissions');

const graphBaseUrl = process.env.FACEBOOK_GRAPH_URL || 'https://graph.facebook.com/v19.0';
const appId = process.env.FACEBOOK_APP_ID;
const appSecret = process.env.FACEBOOK_APP_SECRET;

/**
 * Check if user can manage Facebook connection (Owner/Admin only)
 */
const canManageConnection = async (requestor) => {
  const isOwner = requestor?.role === 'Owner';
  const isAdmin = requestor?.role === 'Administrator';
  const hasPostPermission = await hasPermission(requestor, 'postFacebookContent');
  return isOwner || isAdmin || hasPostPermission;
};

/**
 * GET /api/social/facebook/auth/status
 * Returns current connection status
 */
const getConnectionStatus = async (req, res) => {
  try {
    const connection = await FacebookConnection.getActiveConnection();

    if (!connection) {
      return res.status(200).json({
        connected: false,
        message: 'No Facebook Page connected',
      });
    }

    // Check if token is expired or expiring soon (within 7 days)
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const isExpired = connection.tokenExpiresAt && connection.tokenExpiresAt < now;
    const isExpiringSoon =
      connection.tokenExpiresAt && connection.tokenExpiresAt < sevenDaysFromNow;

    let tokenStatus = 'valid';
    if (isExpired) {
      tokenStatus = 'expired';
    } else if (isExpiringSoon) {
      tokenStatus = 'expiring_soon';
    }

    return res.status(200).json({
      connected: true,
      pageId: connection.pageId,
      pageName: connection.pageName,
      connectedAt: connection.createdAt,
      connectedBy: connection.connectedBy?.name || 'Unknown',
      tokenStatus,
      tokenExpiresAt: connection.tokenExpiresAt,
      lastVerifiedAt: connection.lastVerifiedAt,
      lastError: connection.lastError,
    });
  } catch (error) {
    console.error('[FacebookAuth] getConnectionStatus error:', error.message);
    return res.status(500).json({ error: 'Failed to get connection status' });
  }
};

/**
 * POST /api/social/facebook/auth/callback
 * Exchanges short-lived token for long-lived token and stores connection
 */
const handleAuthCallback = async (req, res) => {
  const { requestor } = req.body;

  if (!(await canManageConnection(requestor))) {
    return res.status(403).json({ error: 'Only Owners and Administrators can connect Facebook.' });
  }

  const { accessToken, userID, grantedScopes } = req.body;

  if (!accessToken || !userID) {
    return res.status(400).json({ error: 'accessToken and userID are required' });
  }

  if (!appId || !appSecret) {
    return res.status(500).json({
      error:
        'Facebook App credentials not configured. Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET.',
    });
  }

  try {
    // Step 1: Exchange short-lived token for long-lived user token
    console.log('[FacebookAuth] Exchanging for long-lived token...');
    const tokenExchangeUrl = `${graphBaseUrl}/oauth/access_token`;
    const tokenResponse = await axios.get(tokenExchangeUrl, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: accessToken,
      },
    });

    const longLivedUserToken = tokenResponse.data.access_token;
    const userTokenExpiresIn = tokenResponse.data.expires_in; // seconds
    const userTokenExpiresAt = new Date(Date.now() + userTokenExpiresIn * 1000);

    console.log(
      '[FacebookAuth] Got long-lived user token, expires in:',
      userTokenExpiresIn,
      'seconds',
    );

    // Step 2: Get list of Pages the user manages
    console.log('[FacebookAuth] Fetching user Pages...');
    const pagesUrl = `${graphBaseUrl}/${userID}/accounts`;
    const pagesResponse = await axios.get(pagesUrl, {
      params: {
        access_token: longLivedUserToken,
        fields: 'id,name,access_token,category',
      },
    });

    const pages = pagesResponse.data.data || [];

    if (pages.length === 0) {
      return res.status(400).json({
        error: 'No Facebook Pages found. Make sure you have admin access to at least one Page.',
      });
    }

    // Return pages for user to select (if multiple)
    // Page access tokens obtained this way are long-lived (no expiry) when derived from long-lived user token
    return res.status(200).json({
      success: true,
      pages: pages.map((p) => ({
        pageId: p.id,
        pageName: p.name,
        category: p.category,
        accessToken: p.access_token, // This is already a long-lived page token
      })),
      userToken: {
        token: longLivedUserToken,
        expiresAt: userTokenExpiresAt,
        userId: userID,
      },
      grantedScopes: grantedScopes?.split(',') || [],
    });
  } catch (error) {
    const fbError = error.response?.data?.error;
    console.error('[FacebookAuth] callback error:', fbError || error.message);
    return res.status(error.response?.status || 500).json({
      error: 'Failed to authenticate with Facebook',
      details: fbError?.message || error.message,
    });
  }
};

/**
 * POST /api/social/facebook/auth/connect
 * Saves the selected Page connection to database
 */
const connectPage = async (req, res) => {
  const { requestor } = req.body;

  if (!(await canManageConnection(requestor))) {
    return res.status(403).json({ error: 'Only Owners and Administrators can connect Facebook.' });
  }

  const { pageId, pageName, pageAccessToken, userToken, grantedScopes } = req.body;

  if (!pageId || !pageAccessToken) {
    return res.status(400).json({ error: 'pageId and pageAccessToken are required' });
  }

  try {
    // Verify the token works by making a test API call
    console.log('[FacebookAuth] Verifying page token...');
    const verifyUrl = `${graphBaseUrl}/${pageId}`;
    const verifyResponse = await axios.get(verifyUrl, {
      params: {
        access_token: pageAccessToken,
        fields: 'id,name',
      },
    });

    const verifiedPageName = verifyResponse.data.name || pageName;

    // Deactivate any existing connections
    await FacebookConnection.deactivateAll({
      odUserId: requestor?.requestorId,
      name: requestor?.name || 'Unknown',
      role: requestor?.role,
    });

    // Create new connection
    const connection = new FacebookConnection({
      pageId,
      pageName: verifiedPageName,
      pageAccessToken,
      // Page tokens derived from long-lived user tokens don't expire
      // but we'll set a far-future date for safety
      tokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      userAccessToken: userToken?.token,
      userTokenExpiresAt: userToken?.expiresAt,
      userId: userToken?.userId,
      isActive: true,
      lastVerifiedAt: new Date(),
      connectedBy: {
        odUserId: requestor?.requestorId,
        name: requestor?.name || 'Unknown',
        role: requestor?.role,
      },
      grantedPermissions: grantedScopes || [],
    });

    await connection.save();

    console.log('[FacebookAuth] Page connected successfully:', pageId, verifiedPageName);

    return res.status(200).json({
      success: true,
      message: `Connected to ${verifiedPageName}`,
      connection: {
        pageId: connection.pageId,
        pageName: connection.pageName,
        connectedAt: connection.createdAt,
      },
    });
  } catch (error) {
    const fbError = error.response?.data?.error;
    console.error('[FacebookAuth] connectPage error:', fbError || error.message);
    return res.status(error.response?.status || 500).json({
      error: 'Failed to connect Facebook Page',
      details: fbError?.message || error.message,
    });
  }
};

/**
 * POST /api/social/facebook/auth/disconnect
 * Disconnects the current Facebook Page
 */
const disconnectPage = async (req, res) => {
  const { requestor } = req.body;

  if (!(await canManageConnection(requestor))) {
    return res
      .status(403)
      .json({ error: 'Only Owners and Administrators can disconnect Facebook.' });
  }

  try {
    const result = await FacebookConnection.deactivateAll({
      odUserId: requestor?.requestorId,
      name: requestor?.name || 'Unknown',
      role: requestor?.role,
    });

    if (result.modifiedCount === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active connection to disconnect',
      });
    }

    console.log('[FacebookAuth] Disconnected Facebook Page');

    return res.status(200).json({
      success: true,
      message: 'Facebook Page disconnected successfully',
    });
  } catch (error) {
    console.error('[FacebookAuth] disconnect error:', error.message);
    return res.status(500).json({
      error: 'Failed to disconnect Facebook Page',
      details: error.message,
    });
  }
};

/**
 * POST /api/social/facebook/auth/verify
 * Verifies the current token still works
 */
const verifyConnection = async (req, res) => {
  try {
    const connection = await FacebookConnection.getActiveConnection();

    if (!connection) {
      return res.status(200).json({ valid: false, reason: 'No active connection' });
    }

    // Test the token
    const verifyUrl = `${graphBaseUrl}/${connection.pageId}`;
    await axios.get(verifyUrl, {
      params: {
        access_token: connection.pageAccessToken,
        fields: 'id,name',
      },
    });

    // Update last verified timestamp
    connection.lastVerifiedAt = new Date();
    connection.lastError = null;
    await connection.save();

    return res.status(200).json({
      valid: true,
      pageId: connection.pageId,
      pageName: connection.pageName,
      lastVerifiedAt: connection.lastVerifiedAt,
    });
  } catch (error) {
    const fbError = error.response?.data?.error;

    // Update connection with error
    const connection = await FacebookConnection.getActiveConnection();
    if (connection) {
      connection.lastError = fbError?.message || error.message;
      await connection.save();
    }

    return res.status(200).json({
      valid: false,
      reason: fbError?.message || error.message,
      errorCode: fbError?.code,
    });
  }
};

module.exports = {
  getConnectionStatus,
  handleAuthCallback,
  connectPage,
  disconnectPage,
  verifyConnection,
};
