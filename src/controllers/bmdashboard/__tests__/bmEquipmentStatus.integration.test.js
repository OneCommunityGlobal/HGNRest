jest.mock('../../../utilities/AzureBlobImages', () => ({
  uploadFileToAzureBlobStorage: jest.fn(),
  deleteBlobFromAzureBlobStorage: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../startup/logger', () => ({ logException: jest.fn() }));
jest.mock('../../../config', () => ({ JWT_SECRET: 'equipment-status-integration-test-only' }));

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const config = require('../../../config');
const verifyToken = require('../../../utilities/jwtVerificationLogic');
const routes = require('../../../routes/bmdashboard/bmEquipmentRouter');
const {
  buildingEquipment: Equipment,
} = require('../../../models/bmdashboard/buildingInventoryItem');
const {
  uploadFileToAzureBlobStorage: upload,
  deleteBlobFromAzureBlobStorage: removeBlob,
} = require('../../../utilities/AzureBlobImages');

// Real HTTP, JWT verification, multipart middleware and Mongoose casting/validation.
// Azure and the database transport are stand-ins; a separate disposable MongoDB check
// verifies actual write/read persistence without making live Azure requests.
describe('equipment status JSON and multipart integration', () => {
  const equipmentId = '507f1f77bcf86cd799439011';
  const authorId = '507f1f77bcf86cd799439012';
  const spoofId = '507f1f77bcf86cd799439013';
  const oldImage = 'https://images.example.test/existing.png';
  const newImage = 'https://images.example.test/new.png';
  const originalAzureConnection = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const originalAzureContainer = process.env.AZURE_STORAGE_CONTAINER_NAME;
  let app;
  let model;
  let stored;
  let token;

  beforeEach(() => {
    jest.clearAllMocks();
    upload.mockReset().mockResolvedValue(newImage);
    removeBlob.mockReset().mockResolvedValue(undefined);
    process.env.AZURE_STORAGE_CONNECTION_STRING = 'test-only-not-a-real-connection';
    process.env.AZURE_STORAGE_CONTAINER_NAME = 'test-only-container';
    stored = new Equipment({ _id: equipmentId, condition: 'Like New', imageUrl: oldImage });
    model = {
      findByIdAndUpdate: jest.fn((id, update, options) => ({
        populate: async () => {
          expect(options).toEqual({ new: true, runValidators: true });
          if (id !== equipmentId) return null;
          stored.updateRecord.push(update.$push.updateRecord);
          if (update.$set) stored.set(update.$set);
          await stored.validate();
          return Equipment.hydrate(JSON.parse(JSON.stringify(stored)));
        },
      })),
      findById: jest.fn(() => ({ populate: () => ({ exec: async () => stored }) })),
    };
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      const payload = verifyToken(req.header('Authorization'), res);
      if (res.headersSent) return;
      req.user = { requestorId: payload.userid, role: payload.role };
      next();
    });
    app.use('/api/bm', routes(model));
    token = jwt.sign(
      {
        userid: authorId,
        role: 'Volunteer',
        expiryTimestamp: new Date(Date.now() + 3600000).toISOString(),
      },
      config.JWT_SECRET,
      { expiresIn: '1h' },
    );
  });

  afterAll(() => {
    if (originalAzureConnection === undefined) delete process.env.AZURE_STORAGE_CONNECTION_STRING;
    else process.env.AZURE_STORAGE_CONNECTION_STRING = originalAzureConnection;
    if (originalAzureContainer === undefined) delete process.env.AZURE_STORAGE_CONTAINER_NAME;
    else process.env.AZURE_STORAGE_CONTAINER_NAME = originalAzureContainer;
  });

  const endpoint = (id = equipmentId) => `/api/bm/equipment/${id}/status`;

  test('JSON preserves false, notes, authenticated author, root image and root condition', async () => {
    const start = Date.now();
    const res = await request(app).put(endpoint()).set('Authorization', token).send({
      condition: 'Good',
      replacementRequired: false,
      lastUsedBy: 'Volunteer',
      lastUsedFor: 'Digging',
      description: '',
      notes: 'JSON note',
      createdBy: spoofId,
      date: '2000-01-01',
      imageUrl: 'https://untrusted.example.test/ignored.png',
    });
    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toBe(oldImage);
    expect(res.body.condition).toBe('Like New');
    expect(res.body.updateRecord).toHaveLength(1);
    const entry = res.body.updateRecord[0];
    expect(entry).toMatchObject({
      condition: 'Good',
      replacementRequired: false,
      lastUsedBy: 'Volunteer',
      lastUsedFor: 'Digging',
      description: '',
      notes: 'JSON note',
      createdBy: authorId,
    });
    expect(new Date(entry.date).getTime()).toBeGreaterThanOrEqual(start);
    expect(entry).not.toHaveProperty('imageUrl');
    expect(model.findByIdAndUpdate.mock.calls[0][1]).not.toHaveProperty('$set');
    expect(upload).not.toHaveBeenCalled();
  });

  test.each(['image/png', 'image/jpeg'])(
    'multipart %s stores image once in root and history',
    async (mime) => {
      const res = await request(app)
        .put(endpoint())
        .set('Authorization', `Bearer ${token}`)
        .field('condition', 'Needs Repair')
        .field('replacementRequired', 'no')
        .field('lastUsedBy', 'Volunteer')
        .field('lastUsedFor', 'Digging')
        .field('description', 'Multipart details')
        .field('notes', 'Multipart note')
        .field('sendNote', 'yes')
        .field('createdBy', spoofId)
        .attach('image', Buffer.from('test-image-bytes'), {
          filename: 'photo.exe',
          contentType: mime,
        });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ imageUrl: newImage, condition: 'Like New' });
      expect(res.body.updateRecord).toHaveLength(1);
      expect(res.body.updateRecord[0]).toMatchObject({
        imageUrl: newImage,
        condition: 'Needs Repair',
        replacementRequired: 'no',
        createdBy: authorId,
        lastUsedBy: 'Volunteer',
        lastUsedFor: 'Digging',
        description: 'Multipart details',
        notes: 'Multipart note',
      });
      expect(res.body.updateRecord[0]).not.toHaveProperty('sendNote');
      expect(upload).toHaveBeenCalledTimes(1);
      expect(upload.mock.calls[0][1]).toMatch(mime === 'image/png' ? /\.png$/ : /\.jpg$/);
      expect(model.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(removeBlob).not.toHaveBeenCalled();
    },
  );

  test('multipart without a file preserves root image and omits history image', async () => {
    const res = await request(app)
      .put(endpoint())
      .set('Authorization', token)
      .field('condition', 'Out of Order')
      .field('replacementRequired', 'no');
    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toBe(oldImage);
    expect(res.body.updateRecord[0]).not.toHaveProperty('imageUrl');
    expect(upload).not.toHaveBeenCalled();
  });

  test.each([
    ['invalid condition', equipmentId, { condition: 'Broken' }, 400, true],
    ['invalid ID', 'not-an-id', { condition: 'Good' }, 400, true],
    ['missing authentication', equipmentId, { condition: 'Good' }, 401, false],
    [
      'invalid replacement',
      equipmentId,
      { condition: 'Good', replacementRequired: 'maybe' },
      400,
      true,
    ],
    ['missing requested note', equipmentId, { condition: 'Good', sendNote: 'yes' }, 400, true],
  ])('%s rejects before Azure upload', async (label, id, fields, status, authenticated) => {
    let req = request(app).put(endpoint(id));
    if (authenticated) req = req.set('Authorization', token);
    Object.entries(fields).forEach(([key, value]) => {
      req = req.field(key, value);
    });
    const res = await req.attach('image', Buffer.from('image'), {
      filename: 'image.png',
      contentType: 'image/png',
    });
    expect(res.status).toBe(status);
    expect(upload).not.toHaveBeenCalled();
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test.each([
    ['database failure', 500],
    ['missing equipment', 404],
    ['validator failure', 400],
  ])('%s cleans up the newly uploaded blob', async (kind, status) => {
    model.findByIdAndUpdate.mockReturnValue({
      populate: async () => {
        if (kind === 'missing equipment') return null;
        if (kind === 'validator failure') throw new mongoose.Error.ValidationError();
        throw new Error('private database details');
      },
    });
    const res = await request(app)
      .put(endpoint())
      .set('Authorization', token)
      .field('condition', 'Good')
      .attach('image', Buffer.from('image'), { filename: 'photo.png', contentType: 'image/png' });
    expect(res.status).toBe(status);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(removeBlob).toHaveBeenCalledTimes(1);
    expect(removeBlob).toHaveBeenCalledWith(upload.mock.calls[0][1]);
    expect(JSON.stringify(res.body)).not.toContain('private database');
  });

  test('Azure failure does not write history or attempt to delete a nonexistent upload', async () => {
    upload.mockRejectedValue(new Error('private Azure details'));
    const res = await request(app)
      .put(endpoint())
      .set('Authorization', token)
      .field('condition', 'Good')
      .attach('image', Buffer.from('image'), { filename: 'photo.png', contentType: 'image/png' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Image selected but not saved.' });
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(removeBlob).not.toHaveBeenCalled();
  });

  test('unsupported multipart image is rejected by the established middleware', async () => {
    const res = await request(app)
      .put(endpoint())
      .set('Authorization', token)
      .field('condition', 'Good')
      .attach('image', Buffer.from('image'), { filename: 'photo.gif', contentType: 'image/gif' });
    expect(res.status).toBe(400);
    expect(upload).not.toHaveBeenCalled();
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
