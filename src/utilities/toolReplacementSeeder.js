/**
 * Seed logic for ToolReplacement documents, linked to real BM buildingProjects.
 *
 * Kept separate from the CLI runner (src/scripts/seedToolReplacements.js) so the
 * logic can be unit tested with mocked models.
 */

/** Multiple tools per real BM project name — same names may repeat across projects */
const PROJECT_TOOLS = {
  'Building 1': [
    { toolName: 'Pliers', requirementSatisfiedPercentage: 42 },
    { toolName: 'Screwdriver', requirementSatisfiedPercentage: 75 },
    { toolName: 'Utility knife', requirementSatisfiedPercentage: 90 },
    { toolName: 'Hammer', requirementSatisfiedPercentage: 96 },
  ],
  'Building 2': [
    { toolName: 'Tape measure', requirementSatisfiedPercentage: 38 },
    { toolName: 'Socket Wrench', requirementSatisfiedPercentage: 75 },
    { toolName: 'Flathead screwdriver', requirementSatisfiedPercentage: 90 },
    { toolName: 'Pliers', requirementSatisfiedPercentage: 96 },
  ],
  'Building 3': [
    { toolName: 'Circular saw', requirementSatisfiedPercentage: 28 },
    { toolName: 'Level', requirementSatisfiedPercentage: 55 },
    { toolName: 'Crowbar', requirementSatisfiedPercentage: 80 },
    { toolName: 'Drill', requirementSatisfiedPercentage: 94 },
  ],
  'Residential Test - Project': [
    { toolName: 'Paint roller', requirementSatisfiedPercentage: 35 },
    { toolName: 'Caulking gun', requirementSatisfiedPercentage: 68 },
    { toolName: 'Putty knife', requirementSatisfiedPercentage: 85 },
    { toolName: 'Sandpaper pack', requirementSatisfiedPercentage: 97 },
  ],
  'Commercial Test - Project': [
    { toolName: 'Angle grinder', requirementSatisfiedPercentage: 22 },
    { toolName: 'Pipe wrench', requirementSatisfiedPercentage: 60 },
    { toolName: 'Torque wrench', requirementSatisfiedPercentage: 78 },
    { toolName: 'Wire stripper', requirementSatisfiedPercentage: 91 },
  ],
};

const DEFAULT_SEED_DATE = new Date('2025-06-15T12:00:00.000Z');

const buildToolReplacementDocs = (projects, seedDate = DEFAULT_SEED_DATE) =>
  projects.flatMap((project) =>
    (PROJECT_TOOLS[project.name] || []).map((tool) => ({
      toolName: tool.toolName,
      requirementSatisfiedPercentage: tool.requirementSatisfiedPercentage,
      projectId: project._id,
      date: seedDate,
    })),
  );

/**
 * Replaces tool-replacement rows for the known BM projects and drops any orphan
 * rows whose projectId no longer exists in buildingProjects.
 *
 * @returns {Promise<{inserted: number, removed: number, seededProjects: Array, missingProjects: string[]}>}
 */
const seedToolReplacements = async ({
  BuildingProject,
  ToolReplacement,
  seedDate = DEFAULT_SEED_DATE,
}) => {
  const projectNames = Object.keys(PROJECT_TOOLS);
  const projects = await BuildingProject.find({ name: { $in: projectNames } }, '_id name').lean();

  const foundNames = new Set(projects.map((project) => project.name));
  const missingProjects = projectNames.filter((name) => !foundNames.has(name));

  if (projects.length === 0) {
    return { inserted: 0, removed: 0, seededProjects: [], missingProjects };
  }

  const projectIds = projects.map((project) => project._id);
  const allBmProjects = await BuildingProject.find({}, '_id').lean();
  const allBmProjectIds = allBmProjects.map((project) => project._id);

  const deleteResult = await ToolReplacement.deleteMany({
    $or: [{ projectId: { $in: projectIds } }, { projectId: { $nin: allBmProjectIds } }],
  });

  const docs = buildToolReplacementDocs(projects, seedDate);
  const inserted = await ToolReplacement.insertMany(docs);

  return {
    inserted: inserted.length,
    removed: deleteResult.deletedCount || 0,
    seededProjects: projects.map((project) => ({
      name: project.name,
      id: String(project._id),
      toolCount: (PROJECT_TOOLS[project.name] || []).length,
    })),
    missingProjects,
  };
};

module.exports = {
  PROJECT_TOOLS,
  DEFAULT_SEED_DATE,
  buildToolReplacementDocs,
  seedToolReplacements,
};
