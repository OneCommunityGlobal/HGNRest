const crypto = require('crypto');
const mongoose = require('mongoose');

/* ── Token encryption (AES-256-GCM) ──
 * TOKEN_ENC_KEY must be 32 random bytes, base64-encoded:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
function getKey() {
  const key = Buffer.from(process.env.TOKEN_ENC_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('TOKEN_ENC_KEY must be 32 bytes, base64-encoded');
  return key;
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString('base64')).join('.');
}

function decrypt(payload) {
  const [iv, tag, enc] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

/* ── Model ── */
const blogSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // blog identifier used in API paths
    title: String,
    uuid: String,
  },
  { _id: false },
);

const tumblrConnectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    tumblrUsername: String,
    accessTokenEnc: { type: String, required: true },
    refreshTokenEnc: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    scope: String,
    blogs: [blogSchema],
    blogsUpdatedAt: Date,
    needsReauth: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const TumblrConnection =
  mongoose.models.TumblrConnection || mongoose.model('TumblrConnection', tumblrConnectionSchema);

module.exports = { TumblrConnection, encrypt, decrypt };
