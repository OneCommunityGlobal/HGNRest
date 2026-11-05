/**
 * Mock data for the Total Construction Summary (BM Dashboard → Reports).
 *
 * Builds realistic records for the existing BM projects over recent weeks so every
 * API-backed chart on the page shows data. All inserted IDs are recorded in a
 * manifest document, so reset removes only the mock records and never touches data
 * created by other developers.
 *
 * Kept separate from the CLI runner (src/scripts/seedTcsMockData.js) so the logic can
 * be unit tested with mocked models.
 */

/** Existing BM project names, so mock data uses the same names the charts already show */
const MOCK_PROJECT_NAMES = [
  'Building 1',
  'Building 2',
  'Building 3',
  'Residential Test - Project',
  'Commercial Test - Project',
];

const MANIFEST_NAME = 'tcs-mock-data';
const WEEKS_OF_DATA = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const ISSUE_TYPES = ['Safety', 'Labor', 'Weather', 'METs quality / functionality', 'Other'];
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const INJURY_TYPES = ['Cut', 'Fall', 'Strain', 'Burn', 'Bruise'];
const DEPARTMENTS = ['Carpentry', 'Electrical', 'Plumbing', 'Masonry'];
const WORKER_CATEGORIES = ['Laborer', 'Electrician', 'Plumber', 'Carpenter'];
const INJURY_SEVERITIES = ['Minor', 'Major', 'Critical'];
const COST_CATEGORIES = ['Labor', 'Materials', 'Equipment'];
const TOOL_NAMES = ['Drill', 'Circular saw', 'Hammer', 'Ladder', 'Concrete mixer', 'Level'];
const TOOL_STATUSES = ['In Use', 'Needs to be replaced', 'Yet to receive'];
const LABOR_TASKS = ['Framing', 'Wiring', 'Plumbing rough-in', 'Drywall', 'Painting'];
const LESSON_TAGS = ['safety', 'planning', 'materials', 'weather', 'teamwork'];

/** Small seeded random generator (linear congruential) so the same seed always gives the same data */
const RANDOM_MODULUS = 4294967296; // 2^32
const RANDOM_MULTIPLIER = 1664525;
const RANDOM_INCREMENT = 1013904223;

const createRandom = (seed = 42) => {
  let state = Math.abs(Math.floor(seed)) % RANDOM_MODULUS;
  const next = () => {
    state = (state * RANDOM_MULTIPLIER + RANDOM_INCREMENT) % RANDOM_MODULUS;
    return state / RANDOM_MODULUS;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
  };
};

/** A date `daysAgo` days before `now`, at a working hour */
const daysBefore = (now, daysAgo, hour = 10) => {
  const date = new Date(now.getTime() - daysAgo * DAY_MS);
  date.setUTCHours(hour, 0, 0, 0);
  return date;
};

const recentDay = (rand) => rand.int(0, WEEKS_OF_DATA * 7 - 1);

const buildIssues = ({ projects, userId, now, rand }) =>
  projects.flatMap((project) =>
    Array.from({ length: 8 }, (_, i) => {
      const issueDate = daysBefore(now, recentDay(rand));
      const isClosed = rand.next() < 0.5;
      const issueType = ISSUE_TYPES[i % ISSUE_TYPES.length];
      return {
        issueDate,
        createdDate: issueDate,
        closedDate: isClosed ? new Date(issueDate.getTime() + rand.int(1, 10) * DAY_MS) : null,
        createdBy: userId,
        issueTitle: [`[Mock] ${issueType} issue ${i + 1}`],
        issueText: [`Mock ${issueType.toLowerCase()} issue logged on ${project.name} for testing.`],
        issueType,
        projectId: project._id,
        status: isClosed ? 'closed' : 'open',
        severity: rand.pick(SEVERITIES),
      };
    }),
  );

const buildInjurySeverities = ({ projects, now, rand }) =>
  projects.flatMap((project) =>
    Array.from({ length: 6 }, () => ({
      projectId: project._id,
      date: daysBefore(now, recentDay(rand)),
      injuryType: rand.pick(INJURY_TYPES),
      department: rand.pick(DEPARTMENTS),
      severity: rand.pick(INJURY_SEVERITIES),
      count: rand.int(1, 3),
    })),
  );

const buildInjuryCategories = ({ projects, now, rand }) =>
  projects.flatMap((project) =>
    Array.from({ length: 6 }, () => ({
      projectId: project._id,
      projectName: project.name,
      date: daysBefore(now, recentDay(rand)),
      injuryType: rand.pick(INJURY_TYPES),
      workerCategory: rand.pick(WORKER_CATEGORIES),
      severity: rand.pick(INJURY_SEVERITIES),
      count: rand.int(1, 4),
    })),
  );

const buildInjuriesOverTime = ({ projects, now, rand }) =>
  projects.flatMap((project) =>
    Array.from({ length: WEEKS_OF_DATA }, (_, week) => ({
      projectId: project._id,
      date: daysBefore(now, week * 7 + rand.int(0, 6)),
      injuryType: rand.pick(INJURY_TYPES),
      department: rand.pick(DEPARTMENTS),
      severity: rand.pick(INJURY_SEVERITIES),
      count: rand.int(0, 3),
    })),
  );

const buildRentals = ({ projects, now, rand }) =>
  projects.flatMap((project) =>
    Array.from({ length: WEEKS_OF_DATA }, (_, week) => ({
      projectId: project._id,
      date: daysBefore(now, week * 7 + rand.int(0, 6)),
      toolName: rand.pick(TOOL_NAMES),
      rentalCost: rand.int(150, 900),
      totalMaterialCost: rand.int(1000, 6000),
    })),
  );

const buildToolReturns = ({ projects, now, rand }) =>
  projects.flatMap((project) =>
    TOOL_NAMES.slice(0, 4).map((toolName) => {
      const totalReturns = rand.int(4, 12);
      return {
        projectId: project._id,
        toolName,
        rentalCost: rand.int(150, 900),
        totalMaterialCost: rand.int(1000, 6000),
        returnedLate: rand.int(0, Math.floor(totalReturns / 2)),
        totalReturns,
        date: daysBefore(now, recentDay(rand)),
      };
    }),
  );

const buildToolsDowntime = ({ projects, now, rand }) =>
  projects.flatMap((project) =>
    TOOL_NAMES.slice(0, 4).map((toolName, i) => {
      const startDate = daysBefore(now, rand.int(7, WEEKS_OF_DATA * 7 - 1));
      return {
        toolId: `MOCK-${String(project._id).slice(-4)}-${i + 1}`,
        toolName,
        projectId: String(project._id),
        utilizationRate: rand.int(40, 95),
        downtimeHours: rand.int(2, 40),
        startDate,
        endDate: new Date(startDate.getTime() + rand.int(1, 5) * DAY_MS),
      };
    }),
  );

const buildToolStoppages = ({ projects, now, rand }) =>
  projects.flatMap((project) =>
    TOOL_NAMES.slice(0, 4).map((toolName) => ({
      projectId: project._id,
      toolName,
      usedForLifetime: rand.int(5, 30),
      damaged: rand.int(0, 6),
      lost: rand.int(0, 3),
      date: daysBefore(now, recentDay(rand)),
    })),
  );

const buildToolAvailability = ({ projects, now, rand }) =>
  projects.flatMap((project) =>
    TOOL_NAMES.map((toolName) => ({
      projectId: project._id,
      toolName,
      status: rand.pick(TOOL_STATUSES),
      quantity: rand.int(1, 10),
      date: daysBefore(now, rand.int(0, 13)),
    })),
  );

const buildExpenditures = ({ projects, rand }) =>
  projects.flatMap((project) =>
    COST_CATEGORIES.flatMap((category) => {
      const planned = rand.int(20000, 80000);
      return [
        { projectId: project._id, category, type: 'planned', amount: planned },
        {
          projectId: project._id,
          category,
          type: 'actual',
          amount: Math.round(planned * (0.8 + rand.next() * 0.4)),
        },
      ];
    }),
  );

const buildCostTracking = ({ projects, now, rand }) =>
  projects.flatMap((project) =>
    Array.from({ length: WEEKS_OF_DATA }, (_, week) =>
      COST_CATEGORIES.map((category) => ({
        projectId: project._id,
        date: daysBefore(now, week * 7),
        category,
        cost: rand.int(1500, 9000),
      })),
    ).flat(),
  );

const buildRiskProfiles = ({ projects, now, rand }) =>
  projects.map((project) => {
    const initialCostEstimate = rand.int(150000, 400000);
    return {
      projectId: project._id,
      startDate: daysBefore(now, rand.int(90, 180)),
      endDate: daysBefore(now, -rand.int(60, 180)),
      initialCostEstimate,
      currentCostIncurred: Math.round(initialCostEstimate * (0.4 + rand.next() * 0.5)),
      issues: [],
      plannedTime: rand.int(180, 365),
      actualTimeElapsed: rand.int(90, 200),
    };
  });

const buildTimeLogs = ({ projects, userId, now, rand }) =>
  projects.flatMap((project) =>
    Array.from({ length: WEEKS_OF_DATA }, (_, week) => {
      const startTime = daysBefore(now, week * 7 + rand.int(0, 4), 8);
      const duration = rand.int(3, 8) * HOUR_MS;
      return {
        project: project._id,
        member: userId,
        task: rand.pick(LABOR_TASKS),
        intervals: [{ startTime, endTime: new Date(startTime.getTime() + duration), duration }],
        totalElapsedTime: duration,
        status: 'completed',
      };
    }),
  );

const buildLessons = ({ projects, userId, now, rand }) =>
  projects.flatMap((project) =>
    Array.from({ length: 3 }, (_, i) => ({
      title: `Mock lesson ${i + 1}`,
      content: `Mock lesson learned on ${project.name}: plan deliveries and safety checks before each phase.`,
      date: daysBefore(now, recentDay(rand)),
      author: userId,
      tags: [rand.pick(LESSON_TAGS), rand.pick(LESSON_TAGS)],
      relatedProject: project._id,
      allowedRoles: 'All',
    })),
  );

const buildMaterials = ({ projects, userId, now, rand, materialTypes }) =>
  projects.flatMap((project) =>
    materialTypes.slice(0, 5).map((type) => {
      const stockBought = rand.int(200, 600);
      const updateRecord = Array.from({ length: WEEKS_OF_DATA * 2 }, (_, i) => ({
        date: daysBefore(now, Math.floor((i * 7) / 2) + rand.int(0, 2)),
        createdBy: userId,
        quantityUsed: rand.int(5, 25),
        quantityWasted: rand.int(0, 4),
      }));
      const stockUsed = updateRecord.reduce((sum, r) => sum + r.quantityUsed, 0);
      const stockWasted = updateRecord.reduce((sum, r) => sum + r.quantityWasted, 0);
      return {
        itemType: type._id,
        project: project._id,
        stockBought,
        stockUsed,
        stockWasted,
        stockAvailable: Math.max(stockBought - stockUsed - stockWasted, 0),
        purchaseRecord: [
          {
            date: daysBefore(now, WEEKS_OF_DATA * 7),
            requestedBy: userId,
            quantity: stockBought,
            priority: rand.pick(['Low', 'Medium', 'High']),
            status: 'Approved',
            unitPrice: rand.int(5, 80),
          },
        ],
        updateRecord,
      };
    }),
  );

const buildTools = ({ projects, userId, now, rand, toolTypes }) =>
  projects.flatMap((project) =>
    toolTypes.slice(0, 4).map((type, i) => ({
      itemType: type._id,
      project: project._id,
      purchaseStatus: i % 2 === 0 ? 'Purchase' : 'Rental',
      purchaseRecord: [
        {
          date: daysBefore(now, WEEKS_OF_DATA * 7),
          requestedBy: userId,
          priority: rand.pick(['Low', 'Medium', 'High']),
          quantity: rand.int(1, 5),
          status: 'Approved',
          unitPrice: rand.int(40, 400),
        },
      ],
      updateRecord: [
        {
          date: daysBefore(now, rand.int(0, 13)),
          createdBy: userId,
          condition: rand.pick(['Good', 'Needs Repair', 'Out of Order']),
        },
      ],
    })),
  );

/** Collection key → { model key, builder } */
const MOCK_COLLECTIONS = [
  ['buildingIssue', buildIssues],
  ['injurySeverity', buildInjurySeverities],
  ['injuryCategory', buildInjuryCategories],
  ['injuryOverTime', buildInjuriesOverTime],
  ['rentalChart', buildRentals],
  ['toolReturn', buildToolReturns],
  ['toolsDowntime', buildToolsDowntime],
  ['toolStoppageReason', buildToolStoppages],
  ['toolAvailability', buildToolAvailability],
  ['expenditure', buildExpenditures],
  ['projectCostTracking', buildCostTracking],
  ['projectRiskProfile', buildRiskProfiles],
  ['timeLog', buildTimeLogs],
  ['newLesson', buildLessons],
  ['buildingMaterial', buildMaterials],
  ['buildingTool', buildTools],
];

/** Splits inventory types into material and tool types (works with category or discriminator) */
const splitInventoryTypes = (types = []) => {
  const kind = (type) => String(type.category || type.__t || '').toLowerCase();
  return {
    materialTypes: types.filter((type) => kind(type).includes('material')),
    toolTypes: types.filter((type) => kind(type).includes('tool')),
  };
};

/** Builds every mock document, grouped by collection key */
const buildMockData = (context) =>
  Object.fromEntries(MOCK_COLLECTIONS.map(([key, build]) => [key, build(context)]));

/**
 * Removes only the records listed in the manifest, then deletes the manifest.
 *
 * @returns {Promise<{removed: number}>}
 */
const resetTcsMockData = async ({ models, Manifest }) => {
  const manifest = await Manifest.findOne({ name: MANIFEST_NAME }).lean();
  if (!manifest) return { removed: 0 };

  let removed = 0;
  await Promise.all(
    (manifest.entries || []).map(async ({ collection, ids }) => {
      const model = models[collection];
      if (!model || !ids?.length) return;
      const result = await model.deleteMany({ _id: { $in: ids } });
      removed += result?.deletedCount || 0;
    }),
  );
  await Manifest.deleteOne({ name: MANIFEST_NAME });
  return { removed };
};

/**
 * Resets any previous mock data, then inserts fresh mock data for the known BM projects
 * and records every inserted ID in the manifest.
 *
 * @returns {Promise<{removed: number, inserted: Object, seededProjects: string[], missingProjects: string[]}>}
 */
const seedTcsMockData = async ({
  models,
  BuildingProject,
  UserProfile,
  InventoryType,
  Manifest,
  now = new Date(),
  seed = 42,
}) => {
  const { removed } = await resetTcsMockData({ models, Manifest });

  const projects = await BuildingProject.find(
    { name: { $in: MOCK_PROJECT_NAMES } },
    '_id name',
  ).lean();
  const foundNames = new Set(projects.map((project) => project.name));
  const missingProjects = MOCK_PROJECT_NAMES.filter((name) => !foundNames.has(name));

  const user = await UserProfile.findOne({ role: 'Administrator', isActive: true }, '_id').lean();

  if (projects.length === 0 || !user) {
    return { removed, inserted: {}, seededProjects: [], missingProjects, missingUser: !user };
  }

  const types = InventoryType ? await InventoryType.find({}, '_id category __t').lean() : [];
  const { materialTypes, toolTypes } = splitInventoryTypes(types);

  const data = buildMockData({
    projects,
    userId: user._id,
    now,
    rand: createRandom(seed),
    materialTypes,
    toolTypes,
  });

  const inserted = {};
  const entries = [];
  // Insert one collection at a time so a failure leaves a clear manifest of what exists
  // eslint-disable-next-line no-restricted-syntax
  for (const [key, docs] of Object.entries(data)) {
    const model = models[key];
    if (model && docs.length) {
      // eslint-disable-next-line no-await-in-loop
      const created = await model.insertMany(docs);
      inserted[key] = created.length;
      entries.push({ collection: key, ids: created.map((doc) => doc._id) });
    }
  }

  await Manifest.create({ name: MANIFEST_NAME, entries, seededAt: now });

  return {
    removed,
    inserted,
    seededProjects: projects.map((project) => project.name),
    missingProjects,
    missingUser: false,
  };
};

module.exports = {
  MOCK_PROJECT_NAMES,
  MANIFEST_NAME,
  MOCK_COLLECTIONS,
  createRandom,
  splitInventoryTypes,
  buildMockData,
  seedTcsMockData,
  resetTcsMockData,
};
