const express = require('express');
const request = require('supertest');

jest.mock('../../middleware/authenticateHelpRequest', () => (req, res, next) => {
  const role = req.header('x-test-role');

  if (!role) {
    return res.status(401).json({ message: 'No token provided' });
  }

  req.user = { role };
  next();
});

jest.mock('../../controllers/attendanceController', () => () => ({
  createAttendanceLog: (req, res) => res.status(200).json({ ok: true }),
  getAttendanceByEvent: (req, res) => res.status(200).json([]),
  getAttendanceSummary: (req, res) => res.status(200).json({}),
  seedAttendanceForEvent: (req, res) => res.status(200).json({ ok: true }),
  getMockAttendanceForEvent: (req, res) => res.status(200).json([]),
  updateAttendanceLog: (req, res) => res.status(200).json({ ok: true }),
  deleteAttendanceLog: (req, res) => res.status(200).json({ ok: true }),
}));

const attendanceRouter = require('../attendanceRouter');

const app = express();
app.use(express.json());
app.use('/api', attendanceRouter);

describe('attendanceRouter permissions', () => {
  it('allows Owner to create attendance', async () => {
    await request(app).post('/api/attendance').set('x-test-role', 'Owner').expect(200);
  });

  it('allows Administrator to update attendance', async () => {
    await request(app)
      .put('/api/attendance/123')
      .set('x-test-role', 'Administrator')
      .send({})
      .expect(200);
  });

  it('blocks a Volunteer from modifying attendance', async () => {
    await request(app).delete('/api/attendance/123').set('x-test-role', 'Volunteer').expect(403);
  });

  it('blocks unauthenticated users from modifying attendance', async () => {
    await request(app).post('/api/attendance/event/123/seed').expect(401);
  });

  it('leaves attendance reads accessible', async () => {
    await request(app).get('/api/attendance/event/123').expect(200);
  });
});
