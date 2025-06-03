const jwt = require('jsonwebtoken');
const moment = require('moment');
const config = require('../config');

module.exports = function (req, res, next) {
  console.log('==== authMiddleware called ====');
  console.log('=== Auth Middleware Start ===');
  console.log('Request URL:', req.originalUrl);
  console.log('Request Method:', req.method);
  console.log('HEADERS:', req.headers);
  console.log('Authorization header:', req.header('Authorization'));
  console.log('JWT_SECRET:', config.JWT_SECRET);
  
  const authHeader = req.header('Authorization');
  console.log('Auth Header:', authHeader ? 'Present' : 'Missing');
  
  if (!authHeader) {
    console.log('Error: No Authorization header');
    return res.status(401).json({ 
      error: 'Unauthorized request',
      details: 'No Authorization header provided'
    });
  }

  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : authHeader;
  
  console.log('Token format:', authHeader.startsWith('Bearer ') ? 'Bearer' : 'Raw');
  console.log('Token:', token);
  
  let payload = '';
  try {
    payload = jwt.verify(token, config.JWT_SECRET);
    console.log('Token verified successfully');
    console.log('Token payload:', payload);
  } catch (error) {
    console.log('JWT verify error:', error.message);
    return res.status(401).json({ 
      error: 'Invalid token',
      details: error.message
    });
  }

  if (!payload) {
    console.log('Error: Empty payload');
    return res.status(401).json({ 
      error: 'Unauthorized request',
      details: 'Empty token payload'
    });
  }

  if (!payload.expiryTimestamp) {
    console.log('Error: Missing expiryTimestamp');
    return res.status(401).json({ 
      error: 'Unauthorized request',
      details: 'Token missing expiry timestamp'
    });
  }

  if (!payload.userid) {
    console.log('Error: Missing userid');
    return res.status(401).json({ 
      error: 'Unauthorized request',
      details: 'Token missing user ID'
    });
  }

  if (!payload.role) {
    console.log('Error: Missing role');
    return res.status(401).json({ 
      error: 'Unauthorized request',
      details: 'Token missing user role'
    });
  }

  if (moment().isAfter(payload.expiryTimestamp)) {
    console.log('Error: Token expired');
    console.log('Current time:', moment().format());
    console.log('Expiry time:', moment(payload.expiryTimestamp).format());
    return res.status(401).json({ 
      error: 'Unauthorized request',
      details: 'Token has expired'
    });
  }

  const requestor = {
    requestorId: payload.userid,
    role: payload.role,
    permissions: payload.permissions,
  };
  
  req.requestor = requestor;
  console.log('Auth successful, requestor:', requestor);
  console.log('=== Auth Middleware End ===');
  next();
}; 