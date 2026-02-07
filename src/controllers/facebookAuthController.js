const axios = require('axios');
const FacebookConnection = require('../models/facebookConnections');
const { hasPermission } = require('../utilities/permissions');

console.log('[FacebookAuth] ===== CONTROLLER LOADED =====');

const dropOldIndex = async () => {
  try {
    await FacebookConnection.collection.dropIndex('pageId_1');
    console.log('[FacebookAuth] Dropped old pageId_1 index');
  } catch (err) {
    if (err.code !== 27) {
      console.log('[FacebookAuth] Index drop note:', err.message);
    }
  }
};
dropOldIndex();

const graphBaseUrl = process.env.FACEBOOK_GRAPH_URL || 'https://graph.facebook.com/v19.0';
const appId = process.env.FACEBOOK_APP_ID;
const appSecret = process.env.FACEBOOK_APP_SECRET;

// ---- Server-side token holding store ----
// Tokens from OAuth callback are held here (keyed by nonce) until
// the user selects a page. Entries auto-expire after 10 minutes.
const pendingConnections = new Map();
const PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Periodic cleanup every 5 minutes for any expired entries
setInterval(
  () => {
    const now = Date.now();
    for (const [nonce, entry] of pendingConnections) {
      if (now - entry.createdAt > PENDING_TTL_MS) {
        pendingConnections.delete(nonce);
      }
    }
  },
  5 * 60 * 1000,
);

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

    let tokenStatus = 'valid';
    if (connection.lastError) {
      const errorLower = connection.lastError.toLowerCase();
      if (
        errorLower.includes('expired') ||
        errorLower.includes('invalid') ||
        errorLower.includes('session')
      ) {
        tokenStatus = 'expired';
      }
    }

    return res.status(200).json({
      connected: true,
      pageId: connection.pageId,
      pageName: connection.pageName,
      connectedAt: connection.createdAt,
      connectedBy: connection.connectedBy?.name || 'Unknown',
      tokenStatus,
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
 * Exchanges short-lived token for long-lived token.
 * Stores tokens SERVER-SIDE and returns only page metadata + nonce.
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
    const userTokenExpiresIn = tokenResponse.data.expires_in || 5184000; // Default 60 days
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

    // Step 3: Store tokens server-side, return only metadata to client
    const selectionNonce = `${userID}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    pendingConnections.set(selectionNonce, {
      pages: pages.map((p) => ({
        pageId: p.id,
        pageName: p.name,
        category: p.category,
        accessToken: p.access_token, // Stays server-side
      })),
      userToken: {
        token: longLivedUserToken,
        expiresAt: userTokenExpiresAt,
        userId: userID,
      },
      grantedScopes: grantedScopes?.split(',') || [],
      createdAt: Date.now(),
    });

    console.log('[FacebookAuth] Stored pending connection, nonce:', selectionNonce);

    // Return page list WITHOUT tokens
    return res.status(200).json({
      success: true,
      selectionNonce,
      pages: pages.map((p) => ({
        pageId: p.id,
        pageName: p.name,
        category: p.category,
        // No accessToken - tokens stay server-side
      })),
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
 * Saves the selected Page connection using server-held tokens.
 * Accepts selectionNonce + pageId (no raw tokens from client).
 */
const connectPage = async (req, res) => {
  console.log('[FacebookAuth] ===== CONNECT PAGE =====');
  const { requestor } = req.body;

  if (!(await canManageConnection(requestor))) {
    return res.status(403).json({ error: 'Only Owners and Administrators can connect Facebook.' });
  }

  const { pageId, pageName, selectionNonce } = req.body;

  if (!pageId || !selectionNonce) {
    return res.status(400).json({ error: 'pageId and selectionNonce are required' });
  }

  // Look up tokens from server-side store
  const pending = pendingConnections.get(selectionNonce);
  if (!pending) {
    return res.status(400).json({
      error: 'Connection session expired or invalid. Please reconnect with Facebook.',
    });
  }

  const selectedPage = pending.pages.find((p) => p.pageId === pageId);
  if (!selectedPage) {
    return res.status(400).json({ error: 'Selected page not found in authorized pages.' });
  }

  // Extract tokens from server-side store (never came from client)
  const pageAccessToken = selectedPage.accessToken;
  const { userToken, grantedScopes } = pending;

  // Clean up pending entry immediately
  pendingConnections.delete(selectionNonce);

  try {
    // Verify the token works
    console.log('[FacebookAuth] Verifying page token...');
    const verifyUrl = `${graphBaseUrl}/${pageId}`;
    const verifyResponse = await axios.get(verifyUrl, {
      params: {
        access_token: pageAccessToken,
        fields: 'id,name',
      },
    });

    const verifiedPageName = verifyResponse.data.name || pageName;

    // Remove existing connections for this page
    await FacebookConnection.deleteMany({ pageId });

    // Deactivate any other active connections (different pages)
    await FacebookConnection.updateMany(
      { pageId: { $ne: pageId }, isActive: true },
      {
        isActive: false,
        disconnectedBy: {
          odUserId: requestor?.requestorId,
          name: requestor?.name || 'Unknown',
          role: requestor?.role,
          disconnectedAt: new Date(),
        },
      },
    );

    // Create fresh connection
    const connection = new FacebookConnection({
      pageId,
      pageName: verifiedPageName,
      pageAccessToken,
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
 */
const verifyConnection = async (req, res) => {
  try {
    const connection = await FacebookConnection.getActiveConnection();

    if (!connection) {
      return res.status(200).json({ valid: false, reason: 'No active connection' });
    }

    const verifyUrl = `${graphBaseUrl}/${connection.pageId}`;
    await axios.get(verifyUrl, {
      params: {
        access_token: connection.pageAccessToken,
        fields: 'id,name',
      },
    });

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
