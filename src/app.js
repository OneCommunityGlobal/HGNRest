require('dotenv').config();
const express = require('express');
const app = express();
// const bodyParser = require('body-parser');
const loginRoutes = require('./routes/loginRoutes');
const pageRoutes = require('./routes/pageRoutes');
const instagramRoutes = require('./routes/instagramRoutes');
const threadsRoutes = require('./routes/threadsRoutes');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { responseLogger, isAuthenticated, cookieLogger, loggerStart, verifyFacebookToken } = require('./middleware');

require('./startup/cors')(app);

app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'session_secret',
  resave: true,
  saveUninitialized: false,
  store: new session.MemoryStore(), // Use MemoryStore for development; switch to a persistent store in production
  cookie: {
    secure: process.env.NODE_ENV === 'production', 
    httpOnly: true, 
    sameSite: false, // Adjust based on your needs
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}))

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// routes

// Logging middleware for all requests
app.use(loggerStart);
app.use(cookieLogger);
app.use(responseLogger);

const apiRouter = express.Router();

// Public routes that don't need authentication
apiRouter.get('/health', (req, res) => {
    return res.status(200).json({
        status: 'success',
        message: 'API is healthy'
    });
});

apiRouter.use('/auth', loginRoutes);

apiRouter.use('/pages', verifyFacebookToken, isAuthenticated, pageRoutes);
apiRouter.use('/instagram', verifyFacebookToken, isAuthenticated, instagramRoutes);
apiRouter.use('/threads', verifyFacebookToken, isAuthenticated, threadsRoutes);

app.use('/api', apiRouter);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 4500;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to access the application`);
    console.log(`Visit http://localhost:${PORT}/api to access the API`);
});

module.exports = app;