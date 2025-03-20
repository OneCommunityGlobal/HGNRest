const { BlobServiceClient } = require("@azure/storage-blob");
const AbortController = require("abort-controller");
const sharp = require('sharp');

global.AbortController = AbortController;


const saveImagestoAzureBlobStorage = async (images, title) => {
	let imageUrls = [];
    if (images) {
      const imageArray = Array.isArray(images) ? images : [images];
      console.log('In Azure Method', title);
      console.log(images);
      let baseName;
      if (title) {
        baseName = title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      } else {
        throw new Error('Title is required');
      }
      const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
      const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINER_NAME);

      imageUrls = await Promise.all(imageArray.map(async (image, index) => {
        const fileNameParts = image.mimetype.split('/');
        const extension = fileNameParts.length > 1 ? fileNameParts.pop() : '';
        const blobName = `${baseName}_${index + 1}${extension ? `.${extension}` : ''}`;
        
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(image.buffer, {
          blobHTTPHeaders: { blobContentType: image.mimetype }
        });
        return blockBlobClient.url;
      }));
    }
    return imageUrls;
}

const streamToBuffer = async (stream) => 
   new Promise((resolve, reject) => {
      const buffers = [];
      stream.on("data", (chunk) => buffers.push(chunk));
      stream.on("end", () => resolve(Buffer.concat(buffers)));
      stream.on("error", reject);
  });


const fetchImagesFromAzureBlobStorage = async (imageUrls) => { 
  if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw new Error("Invalid or empty image URL array provided.");
}
  const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(process.env.AZURE_STORAGE_CONTAINER_NAME);


  const images = await Promise.all(imageUrls.map(async (url) => {
    try {
      const blobName = url.split('/').pop();
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      let imageBuffer;
      console.log(url)
      if(blockBlobClient) {
        const downloadResponse = await blockBlobClient.download();
        imageBuffer = await streamToBuffer(downloadResponse.readableStreamBody);
        imageBuffer = await sharp(imageBuffer).png().toBuffer();
        return `data:image/png;base64,${imageBuffer.toString("base64")}`
      }
        return null;
      
  } catch (error) {
      console.error(`Error processing ${url}:`, error.message);
      return null;
  }
  }));
  return images.filter(img => img !== null);
}

export {saveImagestoAzureBlobStorage, fetchImagesFromAzureBlobStorage};