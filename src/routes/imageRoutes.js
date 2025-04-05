/* eslint-disable quotes */
const express = require('express');
const { BlobServiceClient } = require('@azure/storage-blob');

const { AbortController } = require('abort-controller');
global.AbortController = AbortController;

const routes = function () {
  const imageRouter = express.Router();

  const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const sasToken = process.env.AZURE_SAS_TOKEN;
  const blobServiceClient = new BlobServiceClient(
    `https://${storageAccountName}.blob.core.windows.net?${sasToken}`
  );
  const containerName = process.env.AZURE_STORAGE_ACCOUNT_CONTAINER;

  imageRouter.route('/upload-image').post(async (req, res) => {
    try {
      if (!req.files || !req.files.image) {
        console.log('req.files:', req.files);
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const file = req.files.image;
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

module.exports = routes;