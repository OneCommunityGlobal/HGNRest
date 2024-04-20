const moment = require('moment-timezone');
const { sign } = require('jsonwebtoken');

process.env.JWT_SECRET = 'jk43h5jk43h5k34';
process.env.TOKEN_LIFETIME = 10;
process.env.TOKEN_LIFETIME_UNITS = 'days';

const config = require('../../config');

const jwtPayload = (user) => {
    const payload = {
        userid: user._id,
        role: user.role,
        permissions: user.permissions,
        access: {
            canAccessBMPortal: false,
        },
        email: user.email,
        expiryTimestamp: moment().add(config.TOKEN.Lifetime, config.TOKEN.Units),
    };

    return sign(payload, config.JWT_SECRET);
};

module.exports = jwtPayload;