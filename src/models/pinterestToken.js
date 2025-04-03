const mongoose = require('mongoose');
const { Schema } = mongoose;

const pinterestToken = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'userProfile' },
    accessToken: { type: String, required: true },
    accessTokenExpireAt: { type: Date },
    refreshToken: { type: String, required: true },
    refreshTokenExpireAt: { type: Date },
})

module.exports = mongoose.model('pinterestToken', pinterestToken);