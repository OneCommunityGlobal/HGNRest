const express = require('express');
const chatbotService = require('../services/chatbotService');
const upload = require('../middleware/multerMiddleware');

const router = express.Router();

const DEFAULT_ALLOWED_DOCUMENT_ROLES = ['Owner', 'Administrator', 'Manager'];

const getAllowedDocumentRoles = () => {
  const configuredRoles = process.env.CHATBOT_DOCUMENT_ALLOWED_ROLES;
  if (!configuredRoles || !configuredRoles.trim()) {
    return DEFAULT_ALLOWED_DOCUMENT_ROLES;
  }

  return configuredRoles
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);
};

const requireDocumentAccess = (req, res, next) => {
  const requestorRole = req.body?.requestor?.role;
  const allowedRoles = getAllowedDocumentRoles();

  if (!requestorRole || !allowedRoles.includes(requestorRole)) {
    return res.status(403).json({
      error: 'You are not authorized to manage chatbot documents.',
    });
  }

  return next();
};

router.post('/chatbot/query', (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { message, history } = body;
  const normalizedHistory = Array.isArray(history) ? history : [];
  const replyOptions = Object.prototype.hasOwnProperty.call(body, 'namespace')
    ? { namespace: body.namespace }
    : {};

  chatbotService
    .getChatbotReply(message, normalizedHistory, replyOptions)
    .then((result) => {
      res.status(200).json(result);
    })
    .catch((err) => {
      res.status(500).json({
        reply: 'An error occurred while processing your request.',
        sources: [],
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    });
});

router.get('/chatbot/documents', requireDocumentAccess, async (req, res) => {
  try {
    const { namespace = '' } = req.query || {};
    const result = await chatbotService.listDocuments(namespace);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      error: process.env.NODE_ENV === 'development' ? err.message : 'Unable to list documents.',
    });
  }
});

router.post(
  '/chatbot/documents/upload',
  requireDocumentAccess,
  upload.single('file'),
  async (req, res) => {
    try {
      const result = await chatbotService.uploadAndIndexDocument(req.file, req.body || {});
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({
        error: err.message || 'Unable to upload and index document.',
      });
    }
  },
);

router.post('/chatbot/documents/reindex', requireDocumentAccess, async (req, res) => {
  try {
    const result = await chatbotService.reindexByHash(req.body || {});
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({
      error: err.message || 'Unable to reindex by file hash.',
    });
  }
});

module.exports = router;
