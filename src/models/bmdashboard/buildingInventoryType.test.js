const mongoose = require('mongoose');
// eslint-disable-next-line import/no-extraneous-dependencies
const { MongoMemoryServer } = require('mongodb-memory-server');
const { toolType } = require('./buildingInventoryType');
const { buildingTool } = require('./buildingInventoryItem');
const BuildingProject = require('./buildingProject');

describe('bmdashboard toolType model', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri(), {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('populates available and using tool items with their project, as the Check In/Out page needs', async () => {
    const project = await BuildingProject.create({ name: 'Building 1' });
    const hammerType = await toolType.create({ name: 'Hammer', description: 'Claw hammer' });
    const [availableTool, usingTool] = await buildingTool.create([
      { itemType: hammerType._id, project: project._id, code: '101' },
      { itemType: hammerType._id, project: project._id, code: '102' },
    ]);
    await mongoose.connection
      .collection('buildingInventoryTypes')
      .updateOne(
        { _id: hammerType._id },
        { $set: { available: [availableTool._id], using: [usingTool._id] } },
      );

    const projectPopulate = { path: 'project', select: '_id name' };
    const [result] = await toolType
      .find({ _id: hammerType._id })
      .populate([
        { path: 'available', select: '_id code project', populate: projectPopulate },
        { path: 'using', select: '_id code project', populate: projectPopulate },
      ])
      .lean();

    expect(result.available).toHaveLength(1);
    expect(result.available[0].code).toBe('101');
    expect(result.available[0].project.name).toBe('Building 1');
    expect(result.using).toHaveLength(1);
    expect(result.using[0].code).toBe('102');
  });
});
