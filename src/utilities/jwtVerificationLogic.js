const jwt = require('jsonwebtoken');
const config = require('../config');
const moment = require('moment');

export const jwtVerificationLogic = (authHeader,res)=>{
    // 1. Check Header exists
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized request: No header' });
    }

    // 2. Extract Token from header
    let authToken = authHeader;
    if (authHeader.startsWith('Bearer ')) {
      authToken = authHeader.split(' ')[1];
    } else {
      return res.status(401).json({ error: 'Invalid token format. Expected Bearer <token>' });
    }

    // 3. TOKEN VERIFICATION
    let payload;
    try {
      payload = jwt.verify(authToken, config.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token', details: error.message });
    }

    // 4. PAYLOAD VALIDATION
    const isExpired = moment().isAfter(payload.expiryTimestamp);
    if (!payload || !payload.userid || !payload.role || isExpired) {
      console.log("Auth failed for payload:", payload ? "Valid format" : "Null");
      return res.status(401).send('Unauthorized request: Token expired or invalid payload');
    }
    return payload;
}