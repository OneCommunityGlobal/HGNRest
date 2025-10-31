const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');

dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

async function uploadToS3(file, taskId) {
  const uploadParams = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `tasks/${taskId}/${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  await s3.send(new PutObjectCommand(uploadParams));

  return {
    Key: uploadParams.Key,
    Location: `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${uploadParams.Key}`,
  };
}

module.exports = {
  uploadToS3,
};
