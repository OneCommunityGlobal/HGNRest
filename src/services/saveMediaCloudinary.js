const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Drop-in replacement for the local-disk saveBase64Media — same input
 * (a { base64 } object with a data URI) and same output shape
 * ({ mediaUrl, mediaType }), so nothing in createPost/schedulePost needs
 * to change. Uploads directly to Cloudinary instead of writing to
 * uploads/instagram/ on local disk.
 */
const saveBase64Media = async (media) => {
  if (!media || !media.base64) {
    throw new Error('Media is required.');
  }

  const match = media.base64.match(/^data:(image\/[^;]+|video\/[^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error('Invalid media data.');
  }

  const mimeType = match[1];
  const isVideo = mimeType.startsWith('video');

  let uploadResult;
  try {
    uploadResult = await cloudinary.uploader.upload(media.base64, {
      resource_type: isVideo ? 'video' : 'image',
      folder: 'instagram-autoposter',
    });
  } catch (err) {
    throw new Error(`Cloudinary upload failed: ${err.message}`);
  }

  return {
    mediaUrl: uploadResult.secure_url,
    mediaType: isVideo ? 'VIDEO' : 'IMAGE',
  };
};

module.exports = { saveBase64Media };
