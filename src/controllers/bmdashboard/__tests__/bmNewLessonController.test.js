const bmNewLessonController = require('../bmNewLessonController');

// Mock dependencies
const mockBuildingNewLesson = {
  find: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  findOne: jest.fn(),
  updateMany: jest.fn(),
  deleteMany: jest.fn(),
  getAllTags: jest.fn(),
};

const mockBuildingProject = {
  findById: jest.fn(),
};

const mockLike = {
  findOne: jest.fn(),
  findByIdAndDelete: jest.fn(),
  prototype: {
    save: jest.fn(),
  },
};

// Mock the Like constructor
const MockLikeConstructor = jest.fn().mockImplementation((data) => ({
  ...data,
  _id: 'mockLikeId',
  save: jest.fn().mockResolvedValue({ _id: 'mockLikeId', ...data }),
}));

jest.mock('../../../models/bmdashboard/buildingProject', () => mockBuildingProject);
jest.mock('../../../models/bmdashboard/buldingLessonLike', () => MockLikeConstructor);

describe('bmNewLessonController', () => {
  let controller;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    controller = bmNewLessonController(mockBuildingNewLesson);

    mockReq = {
      body: {},
      params: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('bmGetLessonList', () => {
    it('should return all lessons successfully', async () => {
      const mockLessons = [
        { _id: '1', title: 'Lesson 1' },
        { _id: '2', title: 'Lesson 2' },
      ];

      mockBuildingNewLesson.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          then: jest.fn().mockImplementation((callback) => {
            callback(mockLessons);
            return { catch: jest.fn() };
          }),
        }),
      });

      await controller.bmGetLessonList(mockReq, mockRes);

      expect(mockBuildingNewLesson.find).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith(mockLessons);
    });

    it('should handle database errors', async () => {
      const mockError = new Error('Database error');

      mockBuildingNewLesson.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          then: jest.fn().mockReturnValue({
            catch: jest.fn().mockImplementation((callback) => callback(mockError)),
          }),
        }),
      });

      await controller.bmGetLessonList(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(mockError);
    });
  });

  describe('bmPostLessonList', () => {
    it('should create a new lesson successfully', async () => {
      const mockLessonData = { title: 'New Lesson', content: 'Lesson content' };
      const mockCreatedLesson = { _id: '123', ...mockLessonData };

      mockReq.body = mockLessonData;

      mockBuildingNewLesson.create.mockReturnValue({
        then: jest.fn().mockImplementation((callback) => {
          callback(mockCreatedLesson);
          return { catch: jest.fn() };
        }),
      });

      await controller.bmPostLessonList(mockReq, mockRes);

      expect(mockBuildingNewLesson.create).toHaveBeenCalledWith(mockLessonData);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.send).toHaveBeenCalledWith(mockCreatedLesson);
    });

    it('should handle creation errors', async () => {
      const mockError = new Error('Creation error');
      mockReq.body = { title: 'New Lesson' };

      mockBuildingNewLesson.create.mockReturnValue({
        then: jest.fn().mockReturnValue({
          catch: jest.fn().mockImplementation((callback) => callback(mockError)),
        }),
      });

      await controller.bmPostLessonList(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.send).toHaveBeenCalledWith(mockError);
    });
  });

  describe('bmGetSingleLesson', () => {
    it('should return a single lesson successfully', async () => {
      const mockLesson = { _id: '123', title: 'Test Lesson' };
      mockReq.params.lessonId = '123';

      mockBuildingNewLesson.findById.mockResolvedValue(mockLesson);

      await controller.bmGetSingleLesson(mockReq, mockRes);

      expect(mockBuildingNewLesson.findById).toHaveBeenCalledWith('123');
      expect(mockRes.json).toHaveBeenCalledWith(mockLesson);
    });

    it('should return 404 when lesson not found', async () => {
      mockReq.params.lessonId = '123';
      mockBuildingNewLesson.findById.mockResolvedValue(null);

      await controller.bmGetSingleLesson(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Lesson not found' });
    });

    it('should handle database errors', async () => {
      mockReq.params.lessonId = '123';
      mockBuildingNewLesson.findById.mockRejectedValue(new Error('Database error'));

      await controller.bmGetSingleLesson(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal Server Error' });
    });
  });

  describe('bmEditSingleLesson', () => {
    beforeEach(() => {
      mockReq.params.lessonId = '123';
      mockReq.body = {
        requestor: { requestorId: 'user123', role: 'User' },
        title: 'Updated Lesson',
        content: 'Updated content',
        invalidField: 'should be filtered out',
      };
    });

    it('should update a lesson successfully', async () => {
      const mockLesson = { _id: '123', author: 'user123' };
      const mockUpdatedLesson = { _id: '123', title: 'Updated Lesson', content: 'Updated content' };

      mockBuildingNewLesson.findById.mockResolvedValue(mockLesson);
      mockBuildingNewLesson.findByIdAndUpdate.mockResolvedValue(mockUpdatedLesson);

      await controller.bmEditSingleLesson(mockReq, mockRes);

      expect(mockBuildingNewLesson.findByIdAndUpdate).toHaveBeenCalledWith(
        '123',
        { title: 'Updated Lesson', content: 'Updated content' },
        { new: true },
      );
      expect(mockRes.json).toHaveBeenCalledWith(mockUpdatedLesson);
    });

    it('should filter out non-allowed fields', async () => {
      const mockLesson = { _id: '123', author: 'user123' };
      const mockUpdatedLesson = { _id: '123', title: 'Updated Lesson' };

      mockBuildingNewLesson.findById.mockResolvedValue(mockLesson);
      mockBuildingNewLesson.findByIdAndUpdate.mockResolvedValue(mockUpdatedLesson);

      await controller.bmEditSingleLesson(mockReq, mockRes);

      expect(mockBuildingNewLesson.findByIdAndUpdate).toHaveBeenCalledWith(
        '123',
        expect.not.objectContaining({ invalidField: expect.anything() }),
        { new: true },
      );
    });

    it('should return 404 when lesson not found for update', async () => {
      mockBuildingNewLesson.findById.mockResolvedValue({ _id: '123', author: 'user123' });
      mockBuildingNewLesson.findByIdAndUpdate.mockResolvedValue(null);

      await controller.bmEditSingleLesson(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Lesson not found' });
    });
  });

  describe('bmDeleteSingleLesson', () => {
    beforeEach(() => {
      mockReq.params.lessonId = '123';
      mockReq.body = {
        requestor: { requestorId: 'user123', role: 'User' },
      };
    });

    it('should delete a lesson successfully', async () => {
      const mockLesson = { _id: '123', relatedProject: 'project123' };
      const mockProject = { _id: 'project123', buildingManager: 'user123' };
      const mockDeletedLesson = { _id: '123', title: 'Deleted Lesson' };

      mockBuildingNewLesson.findById.mockResolvedValue(mockLesson);
      mockBuildingProject.findById.mockResolvedValue(mockProject);
      mockBuildingNewLesson.findByIdAndDelete.mockResolvedValue(mockDeletedLesson);

      await controller.bmDeleteSingleLesson(mockReq, mockRes);

      expect(mockBuildingNewLesson.findByIdAndDelete).toHaveBeenCalledWith('123');
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Lesson deleted successfully',
        deletedLesson: mockDeletedLesson,
      });
    });

    it('should return 404 when lesson not found for deletion', async () => {
      const mockLesson = { _id: '123', relatedProject: 'project123' };
      const mockProject = { _id: 'project123', buildingManager: 'user123' };

      mockBuildingNewLesson.findById.mockResolvedValue(mockLesson);
      mockBuildingProject.findById.mockResolvedValue(mockProject);
      mockBuildingNewLesson.findByIdAndDelete.mockResolvedValue(null);

      await controller.bmDeleteSingleLesson(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Lesson not found' });
    });
  });

  describe('addNewTag', () => {
    it('should add a new tag successfully', async () => {
      mockReq.body = { tag: 'newTag' };
      const mockTags = ['existingTag', 'newTag'];

      mockBuildingNewLesson.findOne.mockResolvedValue(null);
      mockBuildingNewLesson.create.mockResolvedValue({});
      mockBuildingNewLesson.getAllTags.mockResolvedValue(mockTags);

      await controller.addNewTag(mockReq, mockRes);

      expect(mockBuildingNewLesson.create).toHaveBeenCalledWith({
        title: 'Tag Storage',
        content: 'Tag Storage Entry',
        tags: ['newTag'],
        author: '000000000000000000000000',
        relatedProject: '000000000000000000000000',
        allowedRoles: 'All',
      });
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockTags);
    });

    it('should return 400 for invalid tag format', async () => {
      mockReq.body = { tag: null };

      await controller.addNewTag(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid tag format' });
    });

    it('should not create duplicate tag storage entries', async () => {
      mockReq.body = { tag: 'existingTag' };
      const mockTags = ['existingTag'];

      mockBuildingNewLesson.findOne.mockResolvedValue({ tags: ['existingTag'] });
      mockBuildingNewLesson.getAllTags.mockResolvedValue(mockTags);

      await controller.addNewTag(mockReq, mockRes);

      expect(mockBuildingNewLesson.create).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(mockTags);
    });
  });

  describe('deleteTag', () => {
    it('should delete a tag successfully', async () => {
      mockReq.params.tag = 'tagToDelete';
      const mockRemainingTags = ['remainingTag'];

      mockBuildingNewLesson.updateMany.mockResolvedValue({});
      mockBuildingNewLesson.deleteMany.mockResolvedValue({});
      mockBuildingNewLesson.getAllTags.mockResolvedValue(mockRemainingTags);

      await controller.deleteTag(mockReq, mockRes);

      expect(mockBuildingNewLesson.updateMany).toHaveBeenCalledWith(
        { tags: 'tagToDelete' },
        { $pull: { tags: 'tagToDelete' } },
      );
      expect(mockBuildingNewLesson.deleteMany).toHaveBeenCalledWith({
        title: 'Tag Storage',
        tags: { $size: 0 },
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockRemainingTags);
    });

    it('should return 400 when tag parameter is missing', async () => {
      mockReq.params = {};

      await controller.deleteTag(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Tag parameter is required' });
    });
  });

  describe('likeLesson', () => {
    beforeEach(() => {
      mockReq.params.lessonId = '123';
      mockReq.body.userId = 'user123';
    });

    it('should like a lesson successfully', async () => {
      MockLikeConstructor.findOne = jest.fn().mockResolvedValue(null);
      mockBuildingNewLesson.findByIdAndUpdate.mockResolvedValue({});

      await controller.likeLesson(mockReq, mockRes);

      expect(MockLikeConstructor).toHaveBeenCalledWith({
        user: 'user123',
        lesson: '123',
      });
      expect(mockBuildingNewLesson.findByIdAndUpdate).toHaveBeenCalledWith('123', {
        $push: { likes: 'mockLikeId' },
      });
      expect(mockBuildingNewLesson.findByIdAndUpdate).toHaveBeenCalledWith('123', {
        $inc: { totalLikes: 1 },
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Lesson liked successfully',
      });
    });

    it('should unlike a lesson when already liked', async () => {
      const mockExistingLike = { _id: 'existingLikeId' };
      MockLikeConstructor.findOne = jest.fn().mockResolvedValue(mockExistingLike);
      MockLikeConstructor.findByIdAndDelete = jest.fn().mockResolvedValue({});

      await controller.likeLesson(mockReq, mockRes);

      expect(MockLikeConstructor.findByIdAndDelete).toHaveBeenCalledWith('existingLikeId');
      expect(mockBuildingNewLesson.findByIdAndUpdate).toHaveBeenCalledWith('123', {
        $pull: { likes: 'existingLikeId' },
      });
      expect(mockBuildingNewLesson.findByIdAndUpdate).toHaveBeenCalledWith('123', {
        $inc: { totalLikes: -1 },
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Lesson unliked successfully',
      });
    });
  });

  describe('getLessonTags', () => {
    it('should return unique sorted tags', async () => {
      const mockLessons = [
        { tags: ['tag1', 'tag2'] },
        { tags: ['tag2', 'tag3'] },
        { tags: ['tag1'] },
      ];

      mockBuildingNewLesson.find.mockResolvedValue(mockLessons);

      await controller.getLessonTags(mockReq, mockRes);

      expect(mockBuildingNewLesson.find).toHaveBeenCalledWith({}, 'tags');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(['tag1', 'tag2', 'tag3']);
    });

    it('should handle errors when fetching tags', async () => {
      mockBuildingNewLesson.find.mockRejectedValue(new Error('Database error'));

      await controller.getLessonTags(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Error fetching tags' });
    });
  });
});
