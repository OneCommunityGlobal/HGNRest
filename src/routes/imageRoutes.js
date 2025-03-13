/* eslint-disable quotes */
const express = require('express');
const { BlobServiceClient } = require('@azure/storage-blob');

const route = function () {
  const imageRouter = express.Router();

  const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const sasToken = process.env.AZURE_SAS_TOKEN;
  const blobServiceClient = new BlobServiceClient(
    `https://${storageAccountName}.blob.core.windows.net${sasToken}`
  );
  const containerName = 'email-images';

  imageRouter.post('/upload-image', async (req, res) => {
    try {
      if (!req.files || !req.files.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const file = req.files.file;
      const containerClient = blobServiceClient.getContainerClient(containerName);

      const timestamp = Date.now();
      const blobName = `${timestamp}-${file.name}`;
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      // Upload the file to Azure Blob Storage
      await blockBlobClient.uploadData(file.data, {
        blobHTTPHeaders: { blobContentType: file.mimetype },
      });

      // Return the public URL
      const url = blockBlobClient.url;
      res.json({ success: true, url });
    } catch (error) {
      console.error('Error uploading image:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  });

  return imageRouter;
};

module.exports = route;