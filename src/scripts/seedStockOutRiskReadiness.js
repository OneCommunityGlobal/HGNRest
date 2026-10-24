// File version: 1.0.0
// Run from HGNRest: node --no-deprecation src/scripts/seedStockOutRiskReadiness.js
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Project = require('../models/bmdashboard/buildingProject');
const Material = require('../models/bmdashboard/buildingMaterial');
const { materialType: MaterialType } = require('../models/bmdashboard/buildingInventoryType');
const materialsController = require('../controllers/bmdashboard/bmMaterialsController');

const PREFIX = '[Stock Risk QA 5709]';
const seedId = (index) =>
  mongoose.Types.ObjectId(`a57a5709${index.toString(16).padStart(16, '0')}`);

function buildFixtures(managerId) {
  const projects = [
    'Ready',
    'Partial',
    'Not Configured',
    'Missing Stock',
    'Missing Mapping',
    'Outside Range',
  ].map((name, index) => ({
    _id: seedId(index + 1),
    name: `${PREFIX} ${name}`,
    isActive: true,
    buildingManager: managerId,
    template: 'Synthetic stock-out readiness QA',
  }));
  const types = ['Cement', 'Lumber'].map((name, index) => ({
    _id: seedId(index + 101),
    name: `${PREFIX} ${name}`,
    description: 'Synthetic stock-out readiness QA material',
    category: 'Material',
    unit: index === 0 ? 'bags' : 'boards',
  }));
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const material = (index, project, type, stockAvailable, stockUsed) => ({
    _id: seedId(index + 201),
    project: projects[project]._id,
    itemType: type === null ? undefined : types[type]._id,
    stockBought: stockAvailable + stockUsed,
    stockAvailable,
    stockUsed,
    stockWasted: 0,
    updateRecord: stockUsed > 0 ? [{ date, quantityUsed: stockUsed, quantityWasted: 0 }] : [],
  });
  const materials = [
    material(0, 0, 0, 15, 150),
    material(1, 0, 1, 120, 120),
    material(2, 1, 0, 15, 150),
    material(3, 1, 1, 40, 0),
    material(4, 3, 0, 0, 150),
    material(5, 4, null, 15, 150),
    material(6, 5, 0, 1500, 30),
  ];
  return { projects, types, materials };
}

async function run() {
  require('dotenv').config();
  const { user, password, cluster, dbName } = process.env;
  assert(
    dbName && /dev|test|local/i.test(dbName) && !/prod/i.test(dbName),
    'Use an explicitly named development/test database; production seeding is refused.',
  );
  assert(user && password && cluster, 'Missing database connection settings.');
  const uri = `mongodb+srv://${cluster}/${dbName}?retryWrites=true&w=majority`;
  await mongoose.connect(uri, {
    user,
    pass: password,
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
  });
  try {
    // The project-list API excludes projects without an existing building manager.
    const [source] = await Project.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: 'userProfiles',
          localField: 'buildingManager',
          foreignField: '_id',
          as: 'manager',
        },
      },
      { $unwind: '$manager' },
      { $limit: 1 },
      { $project: { buildingManager: 1 } },
    ]);
    assert(source, 'An active project with a valid building manager is required.');
    const { projects, types, materials } = buildFixtures(source.buildingManager);
    const groups = [
      [Project, projects],
      [MaterialType, types],
      [Material, materials],
    ];
    const projectIds = projects.map((p) => p._id);

    // Check the complete fixed namespace before writing any fixture.
    for (const [Model, docs] of groups) {
      const existing = await Model.collection
        .find({ _id: { $in: docs.map((doc) => doc._id) } })
        .toArray();
      existing.forEach((doc) =>
        assert(
          Model === Material
            ? projectIds.some((id) => id.equals(doc.project))
            : doc.name?.startsWith(PREFIX),
          'A fixture ID belongs to another record; no changes were made.',
        ),
      );
    }
    for (const [Model, docs] of groups) {
      for (const doc of docs) {
        // Rerunning the seed leaves all existing records, including edited QA data, untouched.
        await Model.updateOne(
          { _id: doc._id },
          { $setOnInsert: doc },
          {
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          },
        );
      }
    }
    let result;
    const res = {
      status(code) {
        assert.equal(code, 200);
        return this;
      },
      json(body) {
        result = body;
      },
    };
    await materialsController(Material).bmGetMaterialStockOutRisk(
      {
        query: { projectIds: projectIds.join(','), includeReadiness: 'true' },
      },
      res,
    );
    assert.deepEqual(
      result.readiness.map((p) => p.status),
      ['Ready', 'Partial', 'Not Configured', 'Partial', 'Partial', 'Partial'],
    );
    assert.deepEqual(
      result.readiness.map((p) => p.readyMaterialCount),
      [2, 1, 0, 0, 0, 0],
    );
    assert.deepEqual(
      result.chartData.map((row) => row.daysUntilStockOut),
      [3, 3, 30],
    );
    result.readiness.forEach((project, index) =>
      console.log(
        `${projects[index].name}: ${project.status}, ${project.readyMaterialCount}/${project.materialCount} ready`,
      ),
    );
    console.log(`Verified against ${dbName}. Existing non-fixture records were not updated.`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  run().catch(async (error) => {
    console.error(
      error.message.replace(/mongodb(?:\+srv)?:\/\/[^@\s]*@/g, 'mongodb://[redacted]@'),
    );
    await mongoose.disconnect();
    process.exitCode = 1;
  });
}

module.exports = { buildFixtures, run };
