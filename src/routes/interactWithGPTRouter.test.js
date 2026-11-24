/* eslint-disable import/order */
jest.mock('../services/interactWithGPTService', () => ({
  generateDraft: jest.fn(async ({ firstName }) => `Draft for ${firstName || 'the user'}`),
}));

const express = require('express');
const request = require('supertest');
const { generateDraft } = require('../services/interactWithGPTService');
const router = require('./interactWithGPTRouter');

describe('POST /api/interactWithGPT', () => {
  const app = express();
  app.use(express.json());
  app.use('/api', router);

  it('returns a generated draft in JSON', async () => {
    const response = await request(app)
      .post('/api/interactWithGPT')
      .send({ prompt: 'Write a greeting', userid: 'user-1', firstName: 'Sam' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ text: 'Draft for Sam' });
  });

  it('returns 400 when prompt is missing', async () => {
    const response = await request(app).post('/api/interactWithGPT').send({ userid: 'user-1' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/prompt is required/);
  });

  it('returns the provider status and error message when generation fails', async () => {
    const error = new Error('LLM service is unavailable.');
    error.statusCode = 502;
    generateDraft.mockRejectedValueOnce(error);

    const response = await request(app)
      .post('/api/interactWithGPT')
      .send({ prompt: 'Write a greeting' });

    expect(response.status).toBe(502);
    expect(response.body).toEqual({ error: 'LLM service is unavailable.' });
  });
});
