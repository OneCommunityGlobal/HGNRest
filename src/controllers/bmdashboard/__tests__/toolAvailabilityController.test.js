const mongoose = require('mongoose');
// eslint-disable-next-line import/no-extraneous-dependencies
const { MongoMemoryServer } = require('mongodb-memory-server');
// The Tools List model: tool_item documents in buildingInventoryItems.
const { buildingTool: BuildingTool } = require('../../../models/bmdashboard/buildingInventoryItem');
const toolAvailabilityController = require('../toolAvailabilityController');
const { getToolAvailability } = require('../bmToolAvailabilityController');

const { ObjectId } = mongoose.Types;

const makeResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

// Two project records share the name "Building 1", like duplicate projects in the dev data.
// The Tools List filters by project name, so both charts must count the tools of both.
const building1 = new ObjectId();
const building1Duplicate = new ObjectId();
const building2 = new ObjectId();

const tool = {
  sawInUse: new ObjectId(),
  sawAvailable: new ObjectId(),
  hammerNeedsReplacing: new ObjectId(),
  hammerAvailable: new ObjectId(),
  drillNotReceived: new ObjectId(),
  hammerOtherProject: new ObjectId(),
};

const type = {
  circularSaw: new ObjectId(),
  circularSawLower: new ObjectId(),
  hammer: new ObjectId(),
  drill: new ObjectId(),
};

describe('Tool availability charts read the Tools List records', () => {
  let mongoServer;
  const controller = toolAvailabilityController(BuildingTool);

  beforeAll(async () => {
    // The library's default MongoDB 4.0 has no build for current Ubuntu CI runners, and
    // MongoDB 7+ dropped the library's default ephemeralForTest engine, so pin both.
    mongoServer = await MongoMemoryServer.create({
      binary: { version: '8.0.4' },
      instance: { storageEngine: 'wiredTiger' },
    });
    await mongoose.connect(mongoServer.getUri(), {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Raw inserts: `using`, `available` and the tool's `condition` are written outside the
    // schemas by the tool update flows, and the Tools List reads them as stored.
    const { db } = mongoose.connection;
    await db.collection('buildingProjects').insertMany([
      { _id: building1, name: 'Building 1' },
      { _id: building1Duplicate, name: 'Building 1' },
      { _id: building2, name: 'Building 2' },
    ]);
    await db.collection('buildingInventoryTypes').insertMany([
      {
        _id: type.circularSaw,
        __t: 'tool_type',
        name: 'Circular Saw',
        description: 'saw',
        using: [tool.sawInUse],
        available: [],
      },
      {
        _id: type.circularSawLower,
        __t: 'tool_type',
        name: 'Circular saw',
        description: 'saw',
        using: [],
        available: [tool.sawAvailable],
      },
      {
        _id: type.hammer,
        __t: 'tool_type',
        name: 'Hammer',
        description: 'hammer',
        using: [],
        available: [tool.hammerNeedsReplacing, tool.hammerAvailable, tool.hammerOtherProject],
      },
      { _id: type.drill, __t: 'tool_type', name: 'Drill', description: 'drill' },
    ]);
    // Separate legacy collection the donut used to read. Nothing in it may be counted.
    await db.collection('buildingTools').insertOne({
      _id: new ObjectId(),
      itemType: type.hammer,
      project: building1,
    });
    await db.collection('buildingInventoryItems').insertMany([
      { __t: 'tool_item', _id: tool.sawInUse, itemType: type.circularSaw, project: building1 },
      {
        __t: 'tool_item',
        _id: tool.sawAvailable,
        itemType: type.circularSawLower,
        project: building1Duplicate,
      },
      {
        __t: 'tool_item',
        _id: tool.hammerNeedsReplacing,
        itemType: type.hammer,
        project: building1,
        condition: 'Needs Replacing',
      },
      {
        __t: 'tool_item',
        _id: tool.hammerAvailable,
        itemType: type.hammer,
        project: building1,
        condition: 'Good',
      },
      { __t: 'tool_item', _id: tool.drillNotReceived, itemType: type.drill, project: building1 },
      { __t: 'tool_item', _id: tool.hammerOtherProject, itemType: type.hammer, project: building2 },
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  const building1Expected = [
    { toolName: 'Circular Saw', inUse: 1, needsReplacement: 0, yetToReceive: 0, available: 1 },
    { toolName: 'Drill', inUse: 0, needsReplacement: 0, yetToReceive: 1, available: 0 },
    { toolName: 'Hammer', inUse: 0, needsReplacement: 1, yetToReceive: 0, available: 1 },
  ];

  describe('getToolsAvailability (Tools by Availability)', () => {
    it('returns 400 for an invalid project ID', async () => {
      const res = makeResponse();
      await controller.getToolsAvailability({ params: { id: 'invalid-id' }, query: {} }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid project ID format' });
    });

    it.each([
      ['the first record', building1],
      ['the duplicate record', building1Duplicate],
    ])(
      'counts every Building 1 tool once, by Tools List status, when asked with %s',
      async (_label, projectId) => {
        const res = makeResponse();
        await controller.getToolsAvailability(
          { params: { id: String(projectId) }, query: {} },
          res,
        );
        expect(res.json).toHaveBeenCalledWith(building1Expected);
      },
    );

    it('ignores the date range, like the Tools List', async () => {
      const res = makeResponse();
      await controller.getToolsAvailability(
        {
          params: { id: String(building1) },
          query: { startDate: '2000-01-01', endDate: '2000-01-31' },
        },
        res,
      );
      expect(res.json).toHaveBeenCalledWith(building1Expected);
    });

    it('returns an empty list for a project with no tools', async () => {
      const res = makeResponse();
      await controller.getToolsAvailability(
        { params: { id: String(new ObjectId()) }, query: {} },
        res,
      );
      expect(res.json).toHaveBeenCalledWith([]);
    });
  });

  describe('getUniqueProjectIds (project dropdown)', () => {
    it('lists each project name with tools once', async () => {
      const res = makeResponse();
      await controller.getUniqueProjectIds({}, res);
      const [projects] = res.json.mock.calls[0];
      expect(projects.map((p) => p.projectName)).toEqual(['Building 1', 'Building 2']);
    });
  });

  describe('getToolAvailability (Proportion of Tools/Equipment donut)', () => {
    it('totals every Building 1 tool by Tools List status, matching the Tools List', async () => {
      const res = makeResponse();
      await getToolAvailability({ query: { projectId: String(building1Duplicate) } }, res);
      const [body] = res.json.mock.calls[0];
      expect(res.status).toHaveBeenCalledWith(200);
      expect(body.total).toBe(5);
      expect(body.data.map(({ status, count }) => [status, count])).toEqual([
        ['Available', 2],
        ['Used', 1],
        ['Needs Replacement', 1],
        ['Yet to Receive', 1],
      ]);
    });
  });
});
