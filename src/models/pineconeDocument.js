const mongoose = require('mongoose');

const pineconeDocumentSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    fileHash: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    namespace: {
      type: String,
      default: '',
      trim: true,
    },
    size: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['uploaded', 'indexing', 'indexed', 'failed'],
      default: 'uploaded',
    },
    chunkCount: {
      type: Number,
      default: 0,
    },
    chunks: {
      type: [String],
      default: [],
    },
    lastIndexedAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: '',
    },
  },
  { timestamps: true },
);

pineconeDocumentSchema.index({ namespace: 1, fileHash: 1 }, { unique: true });

module.exports = mongoose.model('PineconeDocument', pineconeDocumentSchema, 'pineconeDocuments');
