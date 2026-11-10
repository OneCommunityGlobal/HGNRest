const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const BuildingProject = require('../models/bmdashboard/buildingProject');
const BuildingIssue = require('../models/bmdashboard/buildingIssue');
const ToolStoppageReason = require('../models/bmdashboard/buildingToolsStoppage');
const { getUniqueProjectsWithNames } = require('./bmProjectAggregation');

const issueFor = (projectId) => ({
  projectId,
  issueDate: new Date('2026-11-10T12:00:00.000Z'),
  createdBy: new mongoose.Types.ObjectId(),
  issueTitle: ['Fixture issue'],
  issueText: ['Local test data'],
  issueType: 'Safety',
});
const stoppageFor = (projectId) => ({
  projectId,
  toolName: 'Fixture tool',
  usedForLifetime: 1,
  damaged: 0,
  lost: 0,
});

// Run the real helper and production models against a disposable local database.
describe('project aggregation with MongoDB', () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), {
      dbName: 'bm_project_aggregation_tests',
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  beforeEach(async () => {
    await Promise.all(
      [BuildingProject, BuildingIssue, ToolStoppageReason].map((Model) => Model.deleteMany({})),
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  });

  describe.each([
    ['building issues', BuildingIssue, issueFor],
    ['tool stoppages', ToolStoppageReason, stoppageFor],
  ])('%s', (label, Model, makeRecord) => {
    test('deduplicates referenced projects, joins their names and sorts them by name', async () => {
      const [zulu, alpha, middle] = await BuildingProject.create([
        { name: 'Zulu' },
        { name: 'Alpha' },
        { name: 'Middle' },
        { name: 'Unreferenced' },
      ]);
      await Model.create([
        makeRecord(zulu._id),
        makeRecord(alpha._id),
        makeRecord(zulu._id),
        makeRecord(middle._id),
        makeRecord(alpha._id),
      ]);

      await expect(getUniqueProjectsWithNames(Model)).resolves.toEqual([
        { projectId: alpha._id, projectName: 'Alpha' },
        { projectId: middle._id, projectName: 'Middle' },
        { projectId: zulu._id, projectName: 'Zulu' },
      ]);
    });

    test('returns Unknown Project for orphaned IDs and missing, null or empty names', async () => {
      const projects = await BuildingProject.create([{}, { name: null }, { name: '' }]);
      const ids = [...projects.map((project) => project._id), new mongoose.Types.ObjectId()];
      await Model.create(ids.map(makeRecord));

      const result = await getUniqueProjectsWithNames(Model);

      expect(result).toHaveLength(ids.length);
      expect(result.map((row) => String(row.projectId)).sort()).toEqual(ids.map(String).sort());
      result.forEach((row) => expect(row.projectName).toBe('Unknown Project'));
    });

    test('returns no projects when only the project collection has data', async () => {
      await BuildingProject.create({ name: 'Unused project' });

      await expect(getUniqueProjectsWithNames(Model)).resolves.toEqual([]);
    });

    test('reflects a changed project name on the next call', async () => {
      const project = await BuildingProject.create({ name: 'Original' });
      await Model.create(makeRecord(project._id));
      expect(await getUniqueProjectsWithNames(Model)).toEqual([
        { projectId: project._id, projectName: 'Original' },
      ]);
      await BuildingProject.updateOne({ _id: project._id }, { $set: { name: 'Updated' } });

      await expect(getUniqueProjectsWithNames(Model)).resolves.toEqual([
        { projectId: project._id, projectName: 'Updated' },
      ]);
    });

    test('does not change stored project or source documents', async () => {
      const project = await BuildingProject.create({ name: 'Read only' });
      const record = await Model.create(makeRecord(project._id));
      const projectBefore = await BuildingProject.findById(project._id).lean();
      const recordBefore = await Model.findById(record._id).lean();

      await getUniqueProjectsWithNames(Model);

      expect(await BuildingProject.findById(project._id).lean()).toEqual(projectBefore);
      expect(await Model.findById(record._id).lean()).toEqual(recordBefore);
    });
  });

  test('reads each caller model without mixing issues and tool stoppages', async () => {
    const [issueProject, stoppageProject] = await BuildingProject.create([
      { name: 'Issue project' },
      { name: 'Stoppage project' },
    ]);
    await BuildingIssue.create(issueFor(issueProject._id));
    await ToolStoppageReason.create(stoppageFor(stoppageProject._id));

    expect(await getUniqueProjectsWithNames(BuildingIssue)).toEqual([
      { projectId: issueProject._id, projectName: 'Issue project' },
    ]);
    expect(await getUniqueProjectsWithNames(ToolStoppageReason)).toEqual([
      { projectId: stoppageProject._id, projectName: 'Stoppage project' },
    ]);
  });
});
