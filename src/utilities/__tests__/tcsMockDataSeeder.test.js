const {
  MOCK_PROJECT_NAMES,
  MANIFEST_NAME,
  MOCK_COLLECTIONS,
  createRandom,
  splitInventoryTypes,
  buildMockData,
  seedTcsMockData,
  resetTcsMockData,
} = require('../tcsMockDataSeeder');

const NOW = new Date('2026-11-05T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const PROJECTS = [
  { _id: 'p1', name: 'Building 1' },
  { _id: 'p2', name: 'Building 2' },
];
const USER = { _id: 'u1' };

const leanResult = (value) => ({ lean: jest.fn().mockResolvedValue(value) });

const makeModels = () =>
  Object.fromEntries(
    MOCK_COLLECTIONS.map(([key]) => [
      key,
      {
        insertMany: jest.fn((docs) =>
          Promise.resolve(docs.map((doc, i) => ({ ...doc, _id: `${key}-${i}` }))),
        ),
        deleteMany: jest.fn().mockResolvedValue({ deletedCount: 2 }),
      },
    ]),
  );

const makeDeps = ({ projects = PROJECTS, user = USER, manifest = null } = {}) => ({
  models: makeModels(),
  BuildingProject: { find: jest.fn(() => leanResult(projects)) },
  UserProfile: { findOne: jest.fn(() => leanResult(user)) },
  InventoryType: {
    find: jest.fn(() =>
      leanResult([
        { _id: 'm1', category: 'Material' },
        { _id: 't1', category: 'Tool' },
      ]),
    ),
  },
  Manifest: {
    findOne: jest.fn(() => leanResult(manifest)),
    deleteOne: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
  },
  now: NOW,
  createId: (() => {
    let next = 0;
    return () => {
      next += 1;
      return `id-${next}`;
    };
  })(),
});

describe('tcsMockDataSeeder', () => {
  describe('createRandom', () => {
    it('returns the same sequence for the same seed', () => {
      const a = createRandom(7);
      const b = createRandom(7);
      expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
    });

    it('keeps int() within the given range', () => {
      const rand = createRandom(3);
      for (let i = 0; i < 50; i += 1) {
        const value = rand.int(2, 5);
        expect(value).toBeGreaterThanOrEqual(2);
        expect(value).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('splitInventoryTypes', () => {
    it('separates material and tool types by category or discriminator', () => {
      const result = splitInventoryTypes([
        { _id: 'm1', category: 'Material' },
        { _id: 't1', __t: 'tool_type' },
        { _id: 'x1', category: 'Consumable' },
      ]);
      expect(result.materialTypes.map((t) => t._id)).toEqual(['m1']);
      expect(result.toolTypes.map((t) => t._id)).toEqual(['t1']);
    });
  });

  describe('buildMockData', () => {
    const data = buildMockData({
      projects: PROJECTS,
      userId: 'u1',
      now: NOW,
      rand: createRandom(1),
      materialTypes: [{ _id: 'm1' }],
      toolTypes: [{ _id: 't1' }],
    });

    it('builds records for every collection', () => {
      MOCK_COLLECTIONS.forEach(([key]) => {
        expect(data[key].length).toBeGreaterThan(0);
      });
    });

    it('attaches issues to the given projects with valid status and severity', () => {
      data.buildingIssue.forEach((issue) => {
        expect(['p1', 'p2']).toContain(issue.projectId);
        expect(['open', 'closed']).toContain(issue.status);
        expect(['Low', 'Medium', 'High', 'Critical']).toContain(issue.severity);
        expect(issue.createdBy).toBe('u1');
      });
    });

    it('keeps dated records within the last 8 weeks', () => {
      const earliest = NOW.getTime() - 8 * 7 * DAY_MS - DAY_MS;
      ['buildingIssue', 'injurySeverity', 'rentalChart', 'projectCostTracking'].forEach((key) => {
        data[key].forEach((doc) => {
          const time = (doc.issueDate || doc.date).getTime();
          expect(time).toBeGreaterThanOrEqual(earliest);
          expect(time).toBeLessThanOrEqual(NOW.getTime());
        });
      });
    });

    it('includes material usage in the last week', () => {
      const weekAgo = NOW.getTime() - 7 * DAY_MS;
      const recent = data.buildingMaterial.flatMap((m) =>
        m.updateRecord.filter((r) => r.date.getTime() >= weekAgo),
      );
      expect(recent.length).toBeGreaterThan(0);
    });

    it('links each risk profile to an Issues document carrying the project name', () => {
      let next = 0;
      const linked = buildMockData({
        projects: PROJECTS,
        userId: 'u1',
        now: NOW,
        rand: createRandom(1),
        materialTypes: [],
        toolTypes: [],
        createId: () => {
          next += 1;
          return `issue-${next}`;
        },
      });
      linked.projectRiskProfile.forEach((profile, i) => {
        const issueDoc = linked.riskIssue[i];
        expect(profile.projectId).toBe(issueDoc._id);
        expect(profile.issues).toEqual([issueDoc._id]);
        expect(issueDoc.projectName).toBe(PROJECTS[i].name);
      });
    });

    it('creates project status and labor cost rows by project name', () => {
      expect(data.projectStatus.map((row) => row.name)).toEqual(['Building 1', 'Building 2']);
      data.laborCost.forEach((row) => {
        expect(['Building 1', 'Building 2']).toContain(row.project_name);
      });
    });

    it('respects lesson field limits', () => {
      data.newLesson.forEach((lesson) => {
        expect(lesson.title.length).toBeLessThanOrEqual(20);
        lesson.tags.forEach((tag) => expect(tag.length).toBeLessThanOrEqual(10));
      });
    });
  });

  describe('resetTcsMockData', () => {
    it('does nothing when there is no manifest', async () => {
      const deps = makeDeps();
      const result = await resetTcsMockData(deps);
      expect(result).toEqual({ removed: 0 });
      expect(deps.Manifest.deleteOne).not.toHaveBeenCalled();
    });

    it('deletes only the IDs listed in the manifest', async () => {
      const deps = makeDeps({
        manifest: { entries: [{ collectionKey: 'buildingIssue', ids: ['a', 'b'] }] },
      });
      const result = await resetTcsMockData(deps);
      expect(deps.models.buildingIssue.deleteMany).toHaveBeenCalledWith({
        _id: { $in: ['a', 'b'] },
      });
      expect(deps.models.injurySeverity.deleteMany).not.toHaveBeenCalled();
      expect(deps.Manifest.deleteOne).toHaveBeenCalledWith({ name: MANIFEST_NAME });
      expect(result.removed).toBe(2);
    });
  });

  describe('seedTcsMockData', () => {
    it('inserts mock data for found projects and records the IDs in the manifest', async () => {
      const deps = makeDeps();
      const summary = await seedTcsMockData(deps);

      expect(deps.BuildingProject.find).toHaveBeenCalledWith(
        { name: { $in: MOCK_PROJECT_NAMES } },
        '_id name',
      );
      MOCK_COLLECTIONS.forEach(([key]) => {
        expect(deps.models[key].insertMany).toHaveBeenCalled();
      });
      const manifest = deps.Manifest.create.mock.calls[0][0];
      expect(manifest.name).toBe(MANIFEST_NAME);
      expect(manifest.entries).toHaveLength(MOCK_COLLECTIONS.length);
      expect(summary.seededProjects).toEqual(['Building 1', 'Building 2']);
      expect(summary.missingProjects).toEqual(
        MOCK_PROJECT_NAMES.filter((name) => !['Building 1', 'Building 2'].includes(name)),
      );
    });

    it('records every planned ID in the manifest before inserting anything', async () => {
      const deps = makeDeps();
      await seedTcsMockData(deps);

      const manifestOrder = deps.Manifest.create.mock.invocationCallOrder[0];
      MOCK_COLLECTIONS.forEach(([key]) => {
        expect(deps.models[key].insertMany.mock.invocationCallOrder[0]).toBeGreaterThan(
          manifestOrder,
        );
      });

      const manifest = deps.Manifest.create.mock.calls[0][0];
      const issueEntry = manifest.entries.find((entry) => entry.collectionKey === 'buildingIssue');
      const insertedIssues = deps.models.buildingIssue.insertMany.mock.calls[0][0];
      expect(issueEntry.ids).toEqual(insertedIssues.map((doc) => doc._id));
    });

    it('keeps the IDs of a failed run in the manifest so reset can remove them', async () => {
      const deps = makeDeps();
      deps.models.injurySeverity.insertMany = jest
        .fn()
        .mockRejectedValue(new Error('insert failed'));

      await expect(seedTcsMockData(deps)).rejects.toThrow('insert failed');

      const manifest = deps.Manifest.create.mock.calls[0][0];
      const keys = manifest.entries.map((entry) => entry.collectionKey);
      expect(keys).toContain('buildingIssue');
      expect(keys).toContain('injurySeverity');
      manifest.entries.forEach((entry) => expect(entry.ids.length).toBeGreaterThan(0));
    });

    it('requires createId', async () => {
      const deps = makeDeps();
      delete deps.createId;
      await expect(seedTcsMockData(deps)).rejects.toThrow('createId is required');
    });

    it('inserts nothing when no projects are found', async () => {
      const deps = makeDeps({ projects: [] });
      const summary = await seedTcsMockData(deps);
      expect(summary.inserted).toEqual({});
      expect(deps.Manifest.create).not.toHaveBeenCalled();
    });

    it('inserts nothing when no administrator user is found', async () => {
      const deps = makeDeps({ user: null });
      const summary = await seedTcsMockData(deps);
      expect(summary.missingUser).toBe(true);
      expect(deps.Manifest.create).not.toHaveBeenCalled();
    });
  });
});
