const express = require('express');
const request = require('supertest');

jest.mock('../../../startup/logger', () => ({ logException: jest.fn() }));
jest.mock('../../../utilities/AzureBlobImages', () => ({}));
jest.mock('../../../models/bmdashboard/equipmentAttachment', () => ({
  create: jest.fn(),
  findOne: jest.fn(),
}));

const Attachment = require('../../../models/bmdashboard/equipmentAttachment');
const equipmentRouter = require('../../../routes/bmdashboard/bmEquipmentRouter');

const equipmentId = '507f1f77bcf86cd799439011';
const actor = '507f1f77bcf86cd799439012';
const base = `/equipment/${equipmentId}`;

describe('equipment records and attachments', () => {
  let app;
  let Equipment;

  beforeEach(() => {
    jest.resetAllMocks();
    Equipment = {
      exists: jest.fn().mockResolvedValue(true),
      updateOne: jest.fn().mockResolvedValue({ n: 1 }),
      findById: jest.fn(),
    };
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = {
        requestorId: actor,
        access: { canAccessBMPortal: req.get('X-Portal') === 'yes' },
      };
      next();
    });
    app.use(equipmentRouter(Equipment));
  });

  it('adds an update and writes its audit entry in the same operation', async () => {
    await request(app)
      .post(`${base}/records/updates`)
      .set('X-Portal', 'yes')
      .send({ condition: 'Good', createdBy: equipmentId })
      .expect(201);

    expect(Equipment.updateOne).toHaveBeenCalledWith(
      { _id: equipmentId },
      {
        $push: {
          updateRecord: { condition: 'Good', date: expect.any(Date), createdBy: actor },
          auditHistory: {
            $each: [expect.objectContaining({ actor, oldValue: null, newValue: 'Good' })],
          },
        },
      },
    );
  });

  it('edits the selected purchase with a compare-and-set filter', async () => {
    const date = new Date('2026-11-27T12:00:00.000Z');
    Equipment.findById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest
        .fn()
        .mockResolvedValue({ purchaseRecord: [{ date, priority: 'Low', status: 'Pending' }] }),
    });
    await request(app)
      .patch(`${base}/records/purchases/0`)
      .set('X-Portal', 'yes')
      .send({
        priority: 'High',
        status: 'Pending',
        original: { date: date.toISOString(), priority: 'Low', status: 'Pending' },
      })
      .expect(204);

    expect(Equipment.updateOne).toHaveBeenCalledWith(
      {
        _id: equipmentId,
        'purchaseRecord.0.date': date,
        'purchaseRecord.0.priority': 'Low',
        'purchaseRecord.0.status': 'Pending',
      },
      {
        $set: { 'purchaseRecord.0.priority': 'High', 'purchaseRecord.0.status': 'Pending' },
        $push: {
          auditHistory: { $each: [expect.objectContaining({ oldValue: 'Low', newValue: 'High' })] },
        },
      },
    );
  });

  it('stores validated PDF uploads with the authenticated uploader', async () => {
    const content = Buffer.from('%PDF-1.4\n');
    await request(app)
      .post(`${base}/attachments`)
      .set('X-Portal', 'yes')
      .field('category', 'Invoice')
      .attach('file', content, 'invoice.pdf')
      .expect(201);

    expect(Attachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        equipment: equipmentId,
        uploader: actor,
        category: 'Invoice',
        mimeType: 'application/pdf',
        name: 'invoice.pdf',
        size: content.length,
        content,
      }),
    );
  });

  it('rejects files that do not match their declared type or exceed the upload limit', async () => {
    await request(app)
      .post(`${base}/attachments`)
      .set('X-Portal', 'yes')
      .field('category', 'Invoice')
      .attach('file', Buffer.from('<html>'), 'invoice.pdf')
      .expect(400);
    await request(app)
      .post(`${base}/attachments`)
      .set('X-Portal', 'yes')
      .field('category', 'Invoice')
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1), 'invoice.pdf')
      .expect(400);
    expect(Attachment.create).not.toHaveBeenCalled();
  });

  it('scopes the download to the equipment and requires an authorized portal session', async () => {
    const attachmentId = '507f1f77bcf86cd799439013';
    const url = `${base}/attachments/${attachmentId}`;
    await request(app).get(url).expect(403);
    expect(Attachment.findOne).not.toHaveBeenCalled();

    Attachment.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    await request(app).get(url).set('X-Portal', 'yes').expect(404);
    expect(Attachment.findOne).toHaveBeenCalledWith({ _id: attachmentId, equipment: equipmentId });
  });

  it('serves attachment bytes with the validated content type and download filename', async () => {
    const content = Buffer.from('%PDF-1.4\n');
    Attachment.findOne.mockReturnValue({
      select: jest
        .fn()
        .mockResolvedValue({ name: 'invoice.pdf', mimeType: 'application/pdf', content }),
    });
    const response = await request(app)
      .get(`${base}/attachments/507f1f77bcf86cd799439013`)
      .set('X-Portal', 'yes')
      .buffer(true)
      .parse((stream, callback) => {
        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => callback(null, Buffer.concat(chunks)));
        stream.on('error', callback);
      })
      .expect(200)
      .expect('Content-Type', /application\/pdf/)
      .expect('Content-Disposition', /attachment; filename="invoice.pdf"/)
      .expect('Cache-Control', 'private, no-store')
      .expect('X-Content-Type-Options', 'nosniff');
    expect(response.body).toEqual(content);
  });
});
