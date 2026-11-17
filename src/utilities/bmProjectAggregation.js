/**
 * Runs the shared "group by projectId, join to buildingProjects, sort by name"
 * aggregation used by multiple BM Dashboard controllers to build a unique
 * project ID / name list.
 */
const getUniqueProjectsWithNames = async (Model) => {
  const results = await Model.aggregate([
    { $group: { _id: '$projectId' } },
    {
      $lookup: {
        from: 'buildingProjects',
        localField: '_id',
        foreignField: '_id',
        as: 'projectDetails',
      },
    },
    {
      $project: {
        _id: 1,
        projectName: { $arrayElemAt: ['$projectDetails.name', 0] },
      },
    },
    { $sort: { projectName: 1 } },
  ]);

  return results.map((item) => ({
    projectId: item._id,
    projectName: item.projectName || 'Unknown Project',
  }));
};

module.exports = { getUniqueProjectsWithNames };
