const bmMProjectController = function (BuildingProject) {
  const bmProjectSummary = async function _projSumm(req, res) {
    try {
      const projectData = await BuildingProject
        .find()
        .populate([
          {
            path: 'buildingManager',
            select: '_id firstName lastName email',
          },
          {
            path: 'team',
            select: '_id firstName lastName email',
          },
        ])
        .exec()
        .then(result => result)
        .catch(error => res.status(500).send(error));
      res.status(200).send(projectData);
    } catch (err) {
      res.json(err);
    }
  };
  return { bmProjectSummary };
};

module.exports = bmMProjectController;
