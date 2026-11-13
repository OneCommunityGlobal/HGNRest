/* eslint-disable no-magic-numbers -- mock data uses literal counts, ranges and prices on purpose */
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

/**
 * The risk profile summary reads the project name from an `Issues` document whose _id is the
 * risk profile's projectId, so each mock project gets one Issues document with a known _id.
 */
const buildRiskIssues = ({ projects, rand, riskIssueIds = [] }) =>
  projects.map((project, i) => ({
    ...(riskIssueIds[i] ? { _id: riskIssueIds[i] } : {}),
    projectId: project._id,
    projectName: project.name,
    equipmentIssues: rand.int(0, 5),
    laborIssues: rand.int(0, 5),
    materialIssues: rand.int(0, 5),
  }));

const buildRiskProfiles = ({ projects, now, rand, riskIssueIds = [] }) =>
  projects.map((project, i) => {
    const initialCostEstimate = rand.int(150000, 400000);
    const issueId = riskIssueIds[i];
    return {
      projectId: issueId || project._id,
      startDate: daysBefore(now, rand.int(90, 180)),
      endDate: daysBefore(now, -rand.int(60, 180)),
      initialCostEstimate,
      currentCostIncurred: Math.round(initialCostEstimate * (0.4 + rand.next() * 0.5)),
      issues: issueId ? [issueId] : [],
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
      const unitPrice = rand.int(5, 80);
      const updateRecord = Array.from({ length: WEEKS_OF_DATA * 2 }, (_, i) => ({
        date: daysBefore(now, Math.floor((i * 7) / 2) + rand.int(0, 2)),
        createdBy: userId,
        quantityUsed: rand.int(5, 25),
        quantityWasted: rand.int(0, 4),
      }));
      // One approved purchase per week so every weekly period has a material cost
      const purchaseRecord = Array.from({ length: WEEKS_OF_DATA }, (_, week) => ({
        date: daysBefore(now, week * 7 + rand.int(0, 6)),
        requestedBy: userId,
        quantity: rand.int(30, 80),
        priority: rand.pick(['Low', 'Medium', 'High']),
        status: 'Approved',
        unitPrice,
      }));
      const stockUsed = updateRecord.reduce((sum, r) => sum + r.quantityUsed, 0);
      const stockWasted = updateRecord.reduce((sum, r) => sum + r.quantityWasted, 0);
      const stockBought = purchaseRecord.reduce((sum, r) => sum + r.quantity, 0);
      return {
        itemType: type._id,
        project: project._id,
        stockBought,
        stockUsed,
        stockWasted,
        stockAvailable: Math.max(stockBought - stockUsed - stockWasted, 0),
        purchaseRecord,
        updateRecord,
      };
    }),
  );

/** Project status cards match ProjectStatus to BM projects by exact name */
const PROJECT_STATUSES = ['Active', 'Active', 'Completed', 'Delayed', 'Active'];

const buildProjectStatuses = ({ projects, now, rand }) =>
  projects.map((project, i) => {
    const status = PROJECT_STATUSES[i % PROJECT_STATUSES.length];
    return {
      name: project.name,
      status,
      startDate: daysBefore(now, rand.int(90, 200)),
      // Completed within the last week so the default weekly view counts it
      completionDate: status === 'Completed' ? daysBefore(now, now.getUTCDay() + 4) : undefined,
    };
  });

/** LaborCost links to BM projects by project_name */
const buildLaborCosts = ({ projects, now, rand }) =>
  projects.flatMap((project) =>
    Array.from({ length: WEEKS_OF_DATA * 2 }, (_, i) => ({
      project_name: project.name,
      task: rand.pick(LABOR_TASKS),
      cost: rand.int(400, 2500),
      date: daysBefore(now, Math.floor((i * 7) / 2) + rand.int(0, 2)),
    })),
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
  ['riskIssue', buildRiskIssues],
  ['projectRiskProfile', buildRiskProfiles],
  ['timeLog', buildTimeLogs],
  ['newLesson', buildLessons],
  ['buildingMaterial', buildMaterials],
  ['buildingTool', buildTools],
  ['projectStatus', buildProjectStatuses],
  ['laborCost', buildLaborCosts],
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
const buildMockData = (context) => {
  // IDs created up front so risk profiles can point at their Issues documents
  const riskIssueIds = context.createId ? context.projects.map(() => context.createId()) : [];
  const fullContext = { ...context, riskIssueIds };
  return Object.fromEntries(MOCK_COLLECTIONS.map(([key, build]) => [key, build(fullContext)]));
};

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
    (manifest.entries || []).map(async ({ collectionKey, ids }) => {
      const model = models[collectionKey];
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
  createId,
}) => {
  if (typeof createId !== 'function') {
    throw new TypeError('createId is required so every mock record ID is known before inserting');
  }

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
    createId,
  });

  // Give every record its ID up front
  const planned = Object.entries(data)
    .filter(([key, docs]) => models[key] && docs.length)
    .map(([key, docs]) => [key, docs.map((doc) => (doc._id ? doc : { ...doc, _id: createId() }))]);

  // Record every planned ID in the manifest BEFORE inserting anything, so if a run fails
  // part-way, reset can still remove every record that did get inserted
  await Manifest.create({
    name: MANIFEST_NAME,
    entries: planned.map(([key, docs]) => ({
      collectionKey: key,
      ids: docs.map((doc) => doc._id),
    })),
    seededAt: now,
  });

  const inserted = {};
  // eslint-disable-next-line no-restricted-syntax
  for (const [key, docs] of planned) {
    // eslint-disable-next-line no-await-in-loop
    await models[key].insertMany(docs);
    inserted[key] = docs.length;
  }

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
