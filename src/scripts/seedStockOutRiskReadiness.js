// File version: 1.0.3
// Run from HGNRest: node --no-deprecation src/scripts/seedStockOutRiskReadiness.js
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Project = require('../models/bmdashboard/buildingProject');
const { buildingMaterial: Material } = require('../models/bmdashboard/buildingInventoryItem');
const { materialType: MaterialType } = require('../models/bmdashboard/buildingInventoryType');
const materialsController = require('../controllers/bmdashboard/bmMaterialsController');

const PREFIX = '[Stock Risk QA 5709]';
const HEX_RADIX = 16;
const ID_SUFFIX_LENGTH = 16;
const MATERIAL_TYPE_ID_START = 101;
const seedId = (index) =>
  mongoose.Types.ObjectId(`a57a5709${index.toString(HEX_RADIX).padStart(ID_SUFFIX_LENGTH, '0')}`);

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
    _id: seedId(index + MATERIAL_TYPE_ID_START),
    name: `${PREFIX} ${name}`,
    description: 'Synthetic stock-out readiness QA material',
    category: 'Material',
    unit: index === 0 ? 'bags' : 'boards',
  }));
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const material = ({ project, type, stockAvailable, stockUsed }, index) => ({
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
    { project: 0, type: 0, stockAvailable: 15, stockUsed: 150 },
    { project: 0, type: 1, stockAvailable: 120, stockUsed: 120 },
    { project: 1, type: 0, stockAvailable: 15, stockUsed: 150 },
    { project: 1, type: 1, stockAvailable: 40, stockUsed: 0 },
    { project: 3, type: 0, stockAvailable: 0, stockUsed: 150 },
    { project: 4, type: null, stockAvailable: 15, stockUsed: 150 },
    { project: 5, type: 0, stockAvailable: 1500, stockUsed: 30 },
  ].map((inputs, index) => material(inputs, index));
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
    await Promise.all(
      groups.map(async ([Model, docs]) => {
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
      }),
    );
    await Promise.all(
      groups.flatMap(([Model, docs]) =>
        docs.map((doc) =>
          // Rerunning the seed leaves all existing records, including edited QA data, untouched.
          Model.updateOne(
            { _id: doc._id },
            { $setOnInsert: doc },
            {
              upsert: true,
              runValidators: true,
              setDefaultsOnInsert: true,
            },
          ),
        ),
      ),
    );
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
        query: {
          projectIds: projectIds.map((id) => id.toHexString()).join(','),
          includeReadiness: 'true',
        },
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
