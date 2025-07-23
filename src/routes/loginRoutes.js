const express = require('express');
const router = express.Router();

// Import controllers
const metaController = require('../controllers/loginControllers');

// Define main application routes
router.get('/debug-my-session', (req, res) => {
  const isAuth = !!(req.session && req.session.user && req.session.user.isAuthenticated);
  console.log('Debug session - Is authenticated:', isAuth);
  
  res.status(200).json({
    sessionId: req.sessionID,
    session: req.session,
    cookie: req.session.cookie,
    user: req.session.user || null,
    isAuthenticated: isAuth
  });
});
router.post('/facebook/callback', metaController.facebookAuthCallback);
router.post('/facebook/disconnect', metaController.disconnectFacebook);
router.get('/facebook/status', metaController.getFacebookAuthStatus);

router.get('/threads/callback', metaController.threadsAuthCallback);
router.get('/threads/login', metaController.threadsLogin);

module.exports = router;