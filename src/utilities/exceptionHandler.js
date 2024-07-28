const logger = require('../startup/logger');

const exceptionHandler = (err, req, res, next) => {
    logger.logException(err);

    const errStatus = err.statusCode || 500;
    const errMsg = err.message || 'Internal Server Error. Please try again later. If the problem persists, please contact support ID.';
    res.status(errStatus).json({
        success: false,
        status: errStatus,
        message: errMsg,
        stack: !process.env.NODE_ENV || process.env.NODE_ENV === 'local' ? err.stack : {},
    });
    next();
};

export default exceptionHandler;
