const express = require('express');
const request = require('supertest');

jest.mock('../services/chatbotService', () => ({
  getChatbotReply: jest.fn(),
  listDocuments: jest.fn(),
  uploadAndIndexDocument: jest.fn(),
  reindexByHash: jest.fn(),
}));

jest.mock('../middleware/multerMiddleware', () => ({
  single: jest.fn(() => (req, res, next) => {
    req.file = {
      originalname: 'doc.txt',
      size: 12,
      buffer: Buffer.from('hello world'),
    };
    next();
  }),
}));

const chatbotService = require('../services/chatbotService');
const router = require('./chatbotRouter');

describe('POST /chatbot/query', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/', router);
  });

  test('returns 200 with reply and sources from service', async () => {
    chatbotService.getChatbotReply.mockResolvedValue({
      reply: 'Hello from bot',
      sources: [{ id: '1', text: 'ctx' }],
    });

    const res = await request(app)
      .post('/chatbot/query')
      .send({ message: 'What is HGN?' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Hello from bot');
    expect(res.body.sources).toHaveLength(1);
    expect(chatbotService.getChatbotReply).toHaveBeenCalledWith('What is HGN?', []);
  });

  test('passes conversation history to getChatbotReply', async () => {
    chatbotService.getChatbotReply.mockResolvedValue({ reply: 'ok', sources: [] });
    const history = [
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer' },
    ];

    await request(app).post('/chatbot/query').send({ message: 'Follow-up', history });

    expect(chatbotService.getChatbotReply).toHaveBeenCalledWith('Follow-up', history);
  });

  test('normalizes non-array history to an empty array', async () => {
    chatbotService.getChatbotReply.mockResolvedValue({ reply: 'ok', sources: [] });

    await request(app)
      .post('/chatbot/query')
      .send({ message: 'Hi', history: 'not-an-array' });

    expect(chatbotService.getChatbotReply).toHaveBeenCalledWith('Hi', []);
  });

  test('treats missing body history as empty array', async () => {
    chatbotService.getChatbotReply.mockResolvedValue({ reply: 'ok', sources: [] });

    await request(app).post('/chatbot/query').send({ message: 'Hi' });

    expect(chatbotService.getChatbotReply).toHaveBeenCalledWith('Hi', []);
  });

  test('returns 500 when getChatbotReply rejects', async () => {
    chatbotService.getChatbotReply.mockRejectedValue(new Error('upstream failure'));

    const res = await request(app).post('/chatbot/query').send({ message: 'Hi' });

    expect(res.status).toBe(500);
    expect(res.body.reply).toContain('error occurred');
    expect(res.body.sources).toEqual([]);
    expect(res.body.error).toBeUndefined();
  });

  test('includes error message in 500 response when NODE_ENV is development', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    chatbotService.getChatbotReply.mockRejectedValue(new Error('upstream failure'));

    const res = await request(app).post('/chatbot/query').send({ message: 'Hi' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('upstream failure');

    process.env.NODE_ENV = prev;
  });
});

describe('chatbotRouter document management endpoints', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.body = req.body || {};
      if (!req.body.requestor) {
        req.body.requestor = { requestorId: 'test-user', role: 'Administrator' };
      }
      next();
    });
    app.use('/', router);
  });

  test('GET /chatbot/documents returns document list', async () => {
    chatbotService.listDocuments.mockResolvedValue({
      documents: [{ filename: 'doc.txt', fileHash: 'a'.repeat(64) }],
    });

    const res = await request(app).get('/chatbot/documents?namespace=test-space');

    expect(res.status).toBe(200);
    expect(res.body.documents).toHaveLength(1);
    expect(chatbotService.listDocuments).toHaveBeenCalledWith('test-space');
  });

  test('GET /chatbot/documents returns 500 on error', async () => {
    chatbotService.listDocuments.mockRejectedValue(new Error('db down'));

    const res = await request(app).get('/chatbot/documents');

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });

  test('POST /chatbot/documents/upload uploads and indexes document', async () => {
    chatbotService.uploadAndIndexDocument.mockResolvedValue({
      message: 'Document uploaded and indexed successfully.',
    });

    const res = await request(app)
      .post('/chatbot/documents/upload')
      .field('fileHash', 'a'.repeat(64))
      .field('namespace', 'demo');

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('uploaded');
    expect(chatbotService.uploadAndIndexDocument).toHaveBeenCalled();
  });

  test('POST /chatbot/documents/upload returns 400 on validation error', async () => {
    chatbotService.uploadAndIndexDocument.mockRejectedValue(new Error('hash mismatch'));

    const res = await request(app)
      .post('/chatbot/documents/upload')
      .field('fileHash', 'b'.repeat(64));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('hash mismatch');
  });

  test('POST /chatbot/documents/reindex reindexes by hash', async () => {
    chatbotService.reindexByHash.mockResolvedValue({
      message: 'Document reindexed successfully by file hash.',
    });

    const res = await request(app)
      .post('/chatbot/documents/reindex')
      .send({ fileHash: 'a'.repeat(64), namespace: 'demo' });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('reindexed');
    expect(chatbotService.reindexByHash).toHaveBeenCalledWith(
      expect.objectContaining({
        fileHash: 'a'.repeat(64),
        namespace: 'demo',
      }),
    );
  });

  test('POST /chatbot/documents/reindex returns 400 on error', async () => {
    chatbotService.reindexByHash.mockRejectedValue(new Error('not found'));

    const res = await request(app)
      .post('/chatbot/documents/reindex')
      .send({ fileHash: 'c'.repeat(64) });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('not found');
  });

  test('GET /chatbot/documents returns 403 for unauthorized role', async () => {
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.body = req.body || {};
      req.body.requestor = { requestorId: 'test-user', role: 'Volunteer' };
      next();
    });
    app.use('/', router);

    const res = await request(app).get('/chatbot/documents');

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('not authorized');
  });
});
