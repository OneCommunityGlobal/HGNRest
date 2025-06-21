const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const titleController = require('./titleController');

// Mock dependencies
jest.mock('./userProfileController', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    getAllTeamCodeHelper: jest.fn().mockResolvedValue(['TEAM1', 'TEAM2'])
  }))
}));

jest.mock('../utilities/nodeCache', () => jest.fn(() => ({
  getCache: jest.fn(),
  removeCache: jest.fn()
})));

// Mock Project model
jest.mock('../models/project', () => ({
  findOne: jest.fn().mockResolvedValue({ _id: 'mockProjectId' })
}));

describe('Title Controller', () => {
  let mongoServer;
  let Title;
  let controller;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false
    });

    // Mock Title model
    Title = mongoose.model('Title', new mongoose.Schema({
      titleName: String,
      titleCode: String,
      teamCode: String,
      projectAssigned: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
      mediaFolder: String,
      teamAssiged: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
      shortName: String,
      order: Number
    }));

    controller = titleController(Title);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Title.deleteMany({});
  });

  describe('postTitle', () => {
    it('should return 400 for invalid title code', async () => {
      const req = {
        body: {
          titleName: 'New Title',
          titleCode: '123', // Invalid: no letters
          teamCode: 'TEAM1',
          projectAssigned: { _id: new mongoose.Types.ObjectId() },
          mediaFolder: 'media/new',
          teamAssiged: { _id: new mongoose.Types.ObjectId() }
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };

      await controller.postTitle(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Title Code must contain')
        })
      );
    });
  });

  describe('updateTitlesOrder', () => {
    it('should update the order of multiple titles', async () => {
      const projectId = new mongoose.Types.ObjectId();
      const teamId = new mongoose.Types.ObjectId();

      const titles = await Title.insertMany([
        { 
          titleName: 'Title 1', 
          titleCode: 'T1', 
          teamCode: 'TEAM1', 
          mediaFolder: 'media/1',
          projectAssigned: projectId,
          teamAssiged: teamId,
          order: 1 
        },
        { 
          titleName: 'Title 2', 
          titleCode: 'T2', 
          teamCode: 'TEAM1', 
          mediaFolder: 'media/2',
          projectAssigned: projectId,
          teamAssiged: teamId,
          order: 2 
        }
      ]);

      const req = {
        body: {
          orderData: [
            { id: titles[0]._id, order: 2 },
            { id: titles[1]._id, order: 1 }
          ]
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await controller.updateTitlesOrder(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ titleName: 'Title 1', order: 2 }),
          expect.objectContaining({ titleName: 'Title 2', order: 1 })
        ])
      );
    });
  });

  describe('deleteAllTitles', () => {
    it('should delete all titles', async () => {
      const projectId = new mongoose.Types.ObjectId();
      const teamId = new mongoose.Types.ObjectId();

      await Title.insertMany([
        { 
          titleName: 'Title 1', 
          titleCode: 'T1', 
          teamCode: 'TEAM1', 
          mediaFolder: 'media/1',
          projectAssigned: projectId,
          teamAssiged: teamId
        },
        { 
          titleName: 'Title 2', 
          titleCode: 'T2', 
          teamCode: 'TEAM1', 
          mediaFolder: 'media/2',
          projectAssigned: projectId,
          teamAssiged: teamId
        }
      ]);

      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn()
      };

      await controller.deleteAllTitles(req, res);

      const count = await Title.countDocuments();
      expect(count).toBe(0);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('titles were deleted successfully')
        })
      );
    });
  });
});
