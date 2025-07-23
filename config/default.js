module.exports = {
    port: process.env.PORT || 3000,
    db: {
        uri: process.env.DB_URI || 'mongodb://localhost:27017/mydatabase',
    },
    api: {
        prefix: '/api',
    },
    jwtSecret: process.env.JWT_SECRET || 'your_jwt_secret',
    environment: process.env.NODE_ENV || 'development',
};