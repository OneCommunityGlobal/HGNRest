const {
  PROJECT_TOOLS,
  DEFAULT_SEED_DATE,
  buildToolReplacementDocs,
  seedToolReplacements,
} = require('../toolReplacementSeeder');

const BUILDING_1 = { _id: '65419e61105441587e2dec99', name: 'Building 1' };
const BUILDING_2 = { _id: '654946b2bc5772e8caf7e962', name: 'Building 2' };

const makeModels = ({ projects = [], allProjects = null, deletedCount = 3 } = {}) => {
  const BuildingProject = {
    find: jest
      .fn()
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(projects) })
      .mockReturnValueOnce({ lean: jest.fn().mockResolvedValue(allProjects || projects) }),
  };
  const ToolReplacement = {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount }),
    insertMany: jest.fn().mockImplementation((docs) => Promise.resolve(docs)),
  };

  return { BuildingProject, ToolReplacement };
};

describe('toolReplacementSeeder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PROJECT_TOOLS', () => {
    it('defines multiple tools for every BM project', () => {
      const projectNames = Object.keys(PROJECT_TOOLS);

      expect(projectNames).toEqual(
        expect.arrayContaining([
          'Building 1',
          'Building 2',
          'Building 3',
          'Residential Test - Project',
          'Commercial Test - Project',
        ]),
      );
      projectNames.forEach((name) => {
        expect(PROJECT_TOOLS[name].length).toBeGreaterThan(1);
      });
    });

    it('keeps percentages within 0-100', () => {
      Object.values(PROJECT_TOOLS)
        .flat()
        .forEach((tool) => {
          expect(tool.toolName).toEqual(expect.any(String));
          expect(tool.requirementSatisfiedPercentage).toBeGreaterThanOrEqual(0);
          expect(tool.requirementSatisfiedPercentage).toBeLessThanOrEqual(100);
        });
    });
  });

  describe('buildToolReplacementDocs', () => {
    it('creates one doc per tool linked to the real project id', () => {
      const docs = buildToolReplacementDocs([BUILDING_1]);

      expect(docs).toHaveLength(PROJECT_TOOLS['Building 1'].length);
      docs.forEach((doc) => {
        expect(doc.projectId).toBe(BUILDING_1._id);
        expect(doc.date).toEqual(DEFAULT_SEED_DATE);
      });
    });

    it('supports a custom seed date and multiple projects', () => {
      const seedDate = new Date('2026-01-01T00:00:00.000Z');
      const docs = buildToolReplacementDocs([BUILDING_1, BUILDING_2], seedDate);

      const expectedLength =
        PROJECT_TOOLS['Building 1'].length + PROJECT_TOOLS['Building 2'].length;
      expect(docs).toHaveLength(expectedLength);
      expect(docs.every((doc) => doc.date === seedDate)).toBe(true);
      expect(docs.filter((doc) => doc.projectId === BUILDING_2._id)).toHaveLength(
        PROJECT_TOOLS['Building 2'].length,
      );
    });

    it('returns no docs for projects without configured tools', () => {
      expect(buildToolReplacementDocs([{ _id: 'x', name: 'Unknown Project' }])).toEqual([]);
    });
  });

  describe('seedToolReplacements', () => {
    it('replaces rows for found projects and reports a summary', async () => {
      const { BuildingProject, ToolReplacement } = makeModels({
        projects: [BUILDING_1, BUILDING_2],
      });

      const summary = await seedToolReplacements({ BuildingProject, ToolReplacement });

      expect(ToolReplacement.deleteMany).toHaveBeenCalledWith({
        $or: [
          { projectId: { $in: [BUILDING_1._id, BUILDING_2._id] } },
          { projectId: { $nin: [BUILDING_1._id, BUILDING_2._id] } },
        ],
      });
      expect(summary.removed).toBe(3);
      expect(summary.inserted).toBe(
        PROJECT_TOOLS['Building 1'].length + PROJECT_TOOLS['Building 2'].length,
      );
      expect(summary.seededProjects).toEqual([
        {
          name: 'Building 1',
          id: BUILDING_1._id,
          toolCount: PROJECT_TOOLS['Building 1'].length,
        },
        {
          name: 'Building 2',
          id: BUILDING_2._id,
          toolCount: PROJECT_TOOLS['Building 2'].length,
        },
      ]);
    });

    it('reports projects that are missing from buildingProjects', async () => {
      const { BuildingProject, ToolReplacement } = makeModels({ projects: [BUILDING_1] });

      const summary = await seedToolReplacements({ BuildingProject, ToolReplacement });

      expect(summary.missingProjects).toEqual([
        'Building 2',
        'Building 3',
        'Residential Test - Project',
        'Commercial Test - Project',
      ]);
      expect(summary.inserted).toBe(PROJECT_TOOLS['Building 1'].length);
    });

    it('does not touch the collection when no BM projects match', async () => {
      const { BuildingProject, ToolReplacement } = makeModels({ projects: [] });

      const summary = await seedToolReplacements({ BuildingProject, ToolReplacement });

      expect(ToolReplacement.deleteMany).not.toHaveBeenCalled();
      expect(ToolReplacement.insertMany).not.toHaveBeenCalled();
      expect(summary).toEqual({
        inserted: 0,
        removed: 0,
        seededProjects: [],
        missingProjects: Object.keys(PROJECT_TOOLS),
      });
    });

    it('defaults removed count when deleteMany omits deletedCount', async () => {
      const { BuildingProject, ToolReplacement } = makeModels({ projects: [BUILDING_1] });
      ToolReplacement.deleteMany.mockResolvedValue({});

      const summary = await seedToolReplacements({ BuildingProject, ToolReplacement });

      expect(summary.removed).toBe(0);
    });
  });
});
