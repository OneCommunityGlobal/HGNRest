const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');

// Mock dependencies
jest.mock('../../../models/bmdashboard/buildingProject');
jest.mock('../../../models/bmdashboard/buldingLessonLike');

// Import the mocked models
const buildingProject = require('../../../models/bmdashboard/buildingProject');
const Like = require('../../../models/bmdashboard/buldingLessonLike');

describe('Building New Lesson Controller', () => {
  let app;
  let mongoServer;
  let controller;
  let mockBuildingNewLesson;

  beforeAll(async () => {
    // Setup MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Setup Express app
    app = express();
    app.use(bodyParser.json());

    // Create mock for BuildingNewLesson model
    mockBuildingNewLesson = {
      find: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      then: jest.fn().mockImplementation((callback) => {
        callback([{ _id: 'lesson1', title: 'Test Lesson' }]);
        return {
          catch: jest.fn(),
        };
      }),
      create: jest.fn().mockImplementation((data) => ({
        then: jest.fn().mockImplementation((callback) => {
          callback({ _id: 'newLesson', ...data });
          return {
            catch: jest.fn(),
          };
        }),
      })),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
      findOne: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      getAllTags: jest.fn(),
    };

    // Initialize controller
    const bmNewLessonController = require('../bmNewLessonController')(mockBuildingNewLesson);
    controller = bmNewLessonController;

    // Setup routes
    app.get('/lessons', controller.bmGetLessonList);
    app.post('/lessons', controller.bmPostLessonList);
    app.get('/lessons/:lessonId', controller.bmGetSingleLesson);
    app.put('/lessons/:lessonId', controller.bmEditSingleLesson);
    app.delete('/lessons/:lessonId', controller.bmDeleteSingleLesson);
    app.post('/lessons/:lessonId/like', controller.likeLesson);
    app.get('/tags', controller.getLessonTags);
    app.post('/tags', controller.addNewTag);
    app.delete('/tags/:tag', controller.deleteTag);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('bmGetLessonList', () => {
    it('should return a list of lessons', async () => {
      const response = await request(app).get('/lessons');

      expect(response.status).toBe(200);
      expect(mockBuildingNewLesson.find).toHaveBeenCalled();
      expect(mockBuildingNewLesson.populate).toHaveBeenCalled();
      expect(response.body).toEqual([{ _id: 'lesson1', title: 'Test Lesson' }]);
    });
  });

  describe('bmPostLessonList', () => {
    it('should create a new lesson', async () => {
      const lessonData = {
        title: 'New Lesson',
        content: 'Lesson content',
        tags: ['tag1', 'tag2'],
        author: 'author1',
        relatedProject: 'project1',
      };

      const response = await request(app).post('/lessons').send(lessonData);

      expect(response.status).toBe(201);
      expect(mockBuildingNewLesson.create).toHaveBeenCalledWith(lessonData);
      expect(response.body).toMatchObject({
        _id: 'newLesson',
        ...lessonData,
      });
    });
  });

  describe('bmGetSingleLesson', () => {
    it('should return a single lesson by ID', async () => {
      const lessonData = {
        _id: 'lesson123',
        title: 'Specific Lesson',
        content: 'Content',
      };

      mockBuildingNewLesson.findById.mockResolvedValueOnce(lessonData);

      const response = await request(app).get('/lessons/lesson123');

      expect(response.status).toBe(200);
      expect(mockBuildingNewLesson.findById).toHaveBeenCalledWith('lesson123');
      expect(response.body).toEqual(lessonData);
    });

    it('should return 404 if lesson not found', async () => {
      mockBuildingNewLesson.findById.mockResolvedValueOnce(null);

      const response = await request(app).get('/lessons/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Lesson not found' });
    });

    it('should handle errors', async () => {
      mockBuildingNewLesson.findById.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).get('/lessons/error');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal Server Error' });
    });
  });

  describe('bmEditSingleLesson', () => {
    it('should update a lesson with allowed fields', async () => {
      const lessonId = 'lesson123';
      const updateData = {
        title: 'Updated Title',
        content: 'Updated Content',
        tags: ['tag1', 'tag2'],
        relatedProject: 'project1',
        allowedRoles: 'Admin',
        files: ['file1.pdf'],
        // Fields that should be filtered out
        author: 'newAuthor',
        createdAt: new Date(),
      };

      const filteredData = {
        title: 'Updated Title',
        content: 'Updated Content',
        tags: ['tag1', 'tag2'],
        relatedProject: 'project1',
        allowedRoles: 'Admin',
        files: ['file1.pdf'],
      };

      const updatedLesson = {
        _id: lessonId,
        ...filteredData,
      };

      mockBuildingNewLesson.findById.mockResolvedValueOnce({ _id: lessonId, author: 'author1' });
      mockBuildingNewLesson.findByIdAndUpdate.mockResolvedValueOnce(updatedLesson);

      const response = await request(app)
        .put(`/lessons/${lessonId}`)
        .send({
          ...updateData,
          requestor: { requestorId: 'author1', role: 'User' },
        });

      expect(response.status).toBe(200);
      expect(mockBuildingNewLesson.findByIdAndUpdate).toHaveBeenCalledWith(lessonId, filteredData, {
        new: true,
      });
      expect(response.body).toEqual(updatedLesson);
    });

    it('should return 404 if lesson not found during update', async () => {
      const lessonId = 'nonexistent';
      mockBuildingNewLesson.findById.mockResolvedValueOnce({ _id: lessonId });
      mockBuildingNewLesson.findByIdAndUpdate.mockResolvedValueOnce(null);

      const response = await request(app)
        .put(`/lessons/${lessonId}`)
        .send({
          title: 'Updated Title',
          requestor: { requestorId: 'author1', role: 'User' },
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Lesson not found' });
    });

    it('should handle errors during update', async () => {
      const lessonId = 'error';
      mockBuildingNewLesson.findById.mockResolvedValueOnce({ _id: lessonId });
      mockBuildingNewLesson.findByIdAndUpdate.mockRejectedValueOnce(new Error('Update error'));

      const response = await request(app)
        .put(`/lessons/${lessonId}`)
        .send({
          title: 'Error Title',
          requestor: { requestorId: 'author1', role: 'User' },
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal Server Error' });
    });
  });

  describe('bmDeleteSingleLesson', () => {
    it('should delete a lesson', async () => {
      const lessonId = 'lesson123';
      const projectId = 'project1';
      const bmId = 'manager1';

      // Mock the lesson
      mockBuildingNewLesson.findById.mockResolvedValueOnce({
        _id: lessonId,
        relatedProject: projectId,
      });

      // Mock the project
      buildingProject.findById.mockResolvedValueOnce({
        _id: projectId,
        buildingManager: bmId,
      });

      // Mock the delete operation
      const deletedLesson = {
        _id: lessonId,
        title: 'Deleted Lesson',
      };
      mockBuildingNewLesson.findByIdAndDelete.mockResolvedValueOnce(deletedLesson);

      const response = await request(app)
        .delete(`/lessons/${lessonId}`)
        .send({
          requestor: { requestorId: bmId, role: 'BuildingManager' },
        });

      expect(response.status).toBe(200);
      expect(mockBuildingNewLesson.findByIdAndDelete).toHaveBeenCalledWith(lessonId);
      expect(response.body).toEqual({
        message: 'Lesson deleted successfully',
        deletedLesson,
      });
    });

    it('should return 404 if lesson not found during delete', async () => {
      const lessonId = 'nonexistent';

      mockBuildingNewLesson.findById.mockResolvedValueOnce({
        _id: lessonId,
        relatedProject: 'project1',
      });

      buildingProject.findById.mockResolvedValueOnce({
        _id: 'project1',
        buildingManager: 'manager1',
      });

      mockBuildingNewLesson.findByIdAndDelete.mockResolvedValueOnce(null);

      const response = await request(app)
        .delete(`/lessons/${lessonId}`)
        .send({
          requestor: { requestorId: 'manager1', role: 'BuildingManager' },
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Lesson not found' });
    });

    it('should handle errors during delete', async () => {
      const lessonId = 'error';

      mockBuildingNewLesson.findById.mockResolvedValueOnce({
        _id: lessonId,
        relatedProject: 'project1',
      });

      buildingProject.findById.mockResolvedValueOnce({
        _id: 'project1',
        buildingManager: 'manager1',
      });

      mockBuildingNewLesson.findByIdAndDelete.mockRejectedValueOnce(new Error('Delete error'));

      const response = await request(app)
        .delete(`/lessons/${lessonId}`)
        .send({
          requestor: { requestorId: 'manager1', role: 'BuildingManager' },
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal Server Error' });
    });
  });

  describe('likeLesson', () => {
    it('should like a lesson when not previously liked', async () => {
      const lessonId = 'lesson123';
      const userId = 'user1';

      // Mock finding no existing like
      Like.findOne.mockResolvedValueOnce(null);

      // Mock creating a new like
      const mockNewLike = { _id: 'like1', save: jest.fn().mockResolvedValue() };
      Like.mockImplementationOnce(() => mockNewLike);

      // Mock updating the lesson
      mockBuildingNewLesson.findByIdAndUpdate.mockResolvedValueOnce({});

      const response = await request(app).post(`/lessons/${lessonId}/like`).send({ userId });

      expect(response.status).toBe(200);
      expect(Like.findOne).toHaveBeenCalledWith({ user: userId, lesson: lessonId });
      expect(mockNewLike.save).toHaveBeenCalled();
      expect(mockBuildingNewLesson.findByIdAndUpdate).toHaveBeenCalledWith(lessonId, {
        $push: { likes: 'like1' },
      });
      expect(mockBuildingNewLesson.findByIdAndUpdate).toHaveBeenCalledWith(lessonId, {
        $inc: { totalLikes: 1 },
      });
      expect(response.body).toEqual({
        status: 'success',
        message: 'Lesson liked successfully',
      });
    });

    it('should unlike a lesson when previously liked', async () => {
      const lessonId = 'lesson123';
      const userId = 'user1';
      const likeId = 'like1';

      // Mock finding an existing like
      Like.findOne.mockResolvedValueOnce({ _id: likeId });

      // Mock deleting the like
      Like.findByIdAndDelete.mockResolvedValueOnce({});

      // Mock updating the lesson
      mockBuildingNewLesson.findByIdAndUpdate.mockResolvedValueOnce({});

      const response = await request(app).post(`/lessons/${lessonId}/like`).send({ userId });

      expect(response.status).toBe(200);
      expect(Like.findOne).toHaveBeenCalledWith({ user: userId, lesson: lessonId });
      expect(Like.findByIdAndDelete).toHaveBeenCalledWith(likeId);
      expect(mockBuildingNewLesson.findByIdAndUpdate).toHaveBeenCalledWith(lessonId, {
        $pull: { likes: likeId },
      });
      expect(mockBuildingNewLesson.findByIdAndUpdate).toHaveBeenCalledWith(lessonId, {
        $inc: { totalLikes: -1 },
      });
      expect(response.body).toEqual({
        status: 'success',
        message: 'Lesson unliked successfully',
      });
    });

    it('should handle errors', async () => {
      const lessonId = 'error';
      const userId = 'user1';

      Like.findOne.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).post(`/lessons/${lessonId}/like`).send({ userId });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        status: 'error',
        message: 'Error liking/unliking lesson',
      });
    });
  });

  describe('getLessonTags', () => {
    it('should return a list of unique tags', async () => {
      const lessonTags = [
        { tags: ['javascript', 'react'] },
        { tags: ['react', 'node'] },
        { tags: ['express', 'node'] },
      ];

      mockBuildingNewLesson.find.mockResolvedValueOnce(lessonTags);

      const response = await request(app).get('/tags');

      expect(response.status).toBe(200);
      expect(mockBuildingNewLesson.find).toHaveBeenCalledWith({}, 'tags');
      expect(response.body).toEqual(['express', 'javascript', 'node', 'react']);
    });

    it('should handle errors', async () => {
      mockBuildingNewLesson.find.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).get('/tags');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Error fetching tags' });
    });
  });

  describe('addNewTag', () => {
    it('should add a new tag if it does not exist', async () => {
      const newTag = 'newtag';
      const allTags = ['existing', 'newtag'];

      // Tag doesn't exist yet
      mockBuildingNewLesson.findOne.mockResolvedValueOnce(null);

      // Create new tag storage
      mockBuildingNewLesson.create.mockResolvedValueOnce({});

      // Get all tags
      mockBuildingNewLesson.getAllTags.mockResolvedValueOnce(allTags);

      const response = await request(app).post('/tags').send({ tag: newTag });

      expect(response.status).toBe(201);
      expect(mockBuildingNewLesson.findOne).toHaveBeenCalledWith({ tags: newTag });
      expect(mockBuildingNewLesson.create).toHaveBeenCalledWith({
        title: 'Tag Storage',
        content: 'Tag Storage Entry',
        tags: [newTag],
        author: '000000000000000000000000',
        relatedProject: '000000000000000000000000',
        allowedRoles: 'All',
      });
      expect(mockBuildingNewLesson.getAllTags).toHaveBeenCalled();
      expect(response.body).toEqual(allTags);
    });

    it('should not add the tag if it already exists', async () => {
      const existingTag = 'existing';
      const allTags = ['existing', 'another'];

      // Tag already exists
      mockBuildingNewLesson.findOne.mockResolvedValueOnce({ _id: 'lesson1', tags: [existingTag] });

      // Get all tags
      mockBuildingNewLesson.getAllTags.mockResolvedValueOnce(allTags);

      const response = await request(app).post('/tags').send({ tag: existingTag });

      expect(response.status).toBe(201);
      expect(mockBuildingNewLesson.findOne).toHaveBeenCalledWith({ tags: existingTag });
      expect(mockBuildingNewLesson.create).not.toHaveBeenCalled();
      expect(mockBuildingNewLesson.getAllTags).toHaveBeenCalled();
      expect(response.body).toEqual(allTags);
    });

    it('should return 400 for invalid tag format', async () => {
      const response = await request(app).post('/tags').send({ tag: null });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid tag format' });
    });

    it('should handle errors', async () => {
      mockBuildingNewLesson.findOne.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).post('/tags').send({ tag: 'errortag' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Error adding new tag');
      expect(response.body.details).toBeDefined();
    });
  });

  describe('deleteTag', () => {
    it('should delete a tag from all lessons', async () => {
      const tagToDelete = 'obsoletetag';
      const remainingTags = ['tag1', 'tag2'];

      // Mock updateMany
      mockBuildingNewLesson.updateMany.mockResolvedValueOnce({ nModified: 3 });

      // Mock deleteMany
      mockBuildingNewLesson.deleteMany.mockResolvedValueOnce({ deletedCount: 1 });

      // Mock getAllTags
      mockBuildingNewLesson.getAllTags.mockResolvedValueOnce(remainingTags);

      const response = await request(app).delete(`/tags/${tagToDelete}`);

      expect(response.status).toBe(200);
      expect(mockBuildingNewLesson.updateMany).toHaveBeenCalledWith(
        { tags: tagToDelete },
        { $pull: { tags: tagToDelete } },
      );
      expect(mockBuildingNewLesson.deleteMany).toHaveBeenCalledWith({
        title: 'Tag Storage',
        tags: { $size: 0 },
      });
      expect(mockBuildingNewLesson.getAllTags).toHaveBeenCalled();
      expect(response.body).toEqual(remainingTags);
    });

    it('should return 400 if tag parameter is missing', async () => {
      const response = await request(app).delete('/tags/');

      expect(response.status).toBe(404); // Express route not found
    });

    it('should handle errors', async () => {
      mockBuildingNewLesson.updateMany.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app).delete('/tags/errortag');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Error deleting tag');
      expect(response.body.details).toBeDefined();
    });
  });
});
