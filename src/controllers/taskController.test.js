const request = require('supertest');
const mongoose = require('mongoose');
const Task = require('../models/task');
const WBS = require('../models/wbs');
const app = require('../app'); // Assuming you have an Express app in app.js
const taskController = require('./taskController')(Task);

jest.mock('../models/task');
jest.mock('../models/wbs');
jest.mock('../utilities/permissions', () => ({
  hasPermission: jest.fn(() => Promise.resolve(true)),
}));

describe('Task Controller', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTasks', () => {
    it('should return tasks based on query parameters', async () => {
      const mockTasks = [{ _id: '1', name: 'Task 1' }];
      Task.find.mockResolvedValue(mockTasks);

      const res = await request(app).get('/tasks/1/2/0');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockTasks);
      expect(Task.find).toHaveBeenCalledWith({
        wbsId: { $in: ['1'] },
        level: { $in: ['2'] },
        isActive: { $ne: false },
      });
    });

    it('should return 404 if tasks are not found', async () => {
      Task.find.mockRejectedValue(new Error('Not Found'));

      const res = await request(app).get('/tasks/1/2/0');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({});
    });
  });

  describe('postTask', () => {
    it('should create a new task', async () => {
      const mockTask = { _id: '1', taskName: 'New Task', isActive: true };
      Task.prototype.save = jest.fn().mockResolvedValue(mockTask);

      const res = await request(app)
        .post('/tasks/1')
        .send({ taskName: 'New Task', isActive: true, requestor: 'user1' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(mockTask);
    });

    it('should return 403 if user lacks permission', async () => {
      require('../utilities/permissions').hasPermission.mockResolvedValue(false);

      const res = await request(app)
        .post('/tasks/1')
        .send({ taskName: 'New Task', isActive: true, requestor: 'user1' });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'You are not authorized to create new Task.' });
    });

    it('should return 400 if mandatory fields are missing', async () => {
      const res = await request(app).post('/tasks/1').send({ isActive: true });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: 'Task Name, Active status are mandatory fields',
      });
    });
  });

  describe('deleteTask', () => {
    it('should delete a task and its children', async () => {
      Task.find.mockResolvedValue([{ _id: '1' }]);
      Task.findById.mockResolvedValue({ save: jest.fn() });
      Task.findOneAndDelete = jest.fn().mockResolvedValue(true);

      const res = await request(app)
        .delete('/tasks/1')
        .send({ requestor: 'user1', mother: 'null' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Task successfully deleted' });
    });

    it('should return 403 if user lacks permission', async () => {
      require('../utilities/permissions').hasPermission.mockResolvedValue(false);

      const res = await request(app)
        .delete('/tasks/1')
        .send({ requestor: 'user1', mother: 'null' });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'You are not authorized to deleteTasks.' });
    });
  });

  describe('updateTask', () => {
    it('should update a task', async () => {
      Task.findById.mockResolvedValue({ save: jest.fn() });
      Task.findOneAndUpdate = jest.fn().mockResolvedValue(true);

      const res = await request(app)
        .put('/tasks/1')
        .send({ taskName: 'Updated Task', requestor: 'user1' });

      expect(res.status).toBe(201);
    });

    it('should return 403 if user lacks permission', async () => {
      require('../utilities/permissions').hasPermission.mockResolvedValue(false);

      const res = await request(app)
        .put('/tasks/1')
        .send({ taskName: 'Updated Task', requestor: 'user1' });

      expect(res.status).toBe(403);
    });
  });

  describe('getWBSId', () => {
    it('should return WBS by ID', async () => {
      const mockWBS = { _id: '1', name: 'WBS 1' };
      WBS.findById.mockResolvedValue(mockWBS);

      const res = await request(app).get('/wbs/1');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockWBS);
    });

    it('should return 404 if WBS is not found', async () => {
      WBS.findById.mockRejectedValue(new Error('Not Found'));

      const res = await request(app).get('/wbs/1');

      expect(res.status).toBe(404);
    });
  });
});