const bmMProjectController = function (BuildingProject) {
  // fetches all projects by building manager id
  const fetchAllProjects = async (req, res) => {
    const { userId } = req.params;
     try {
      const projectData = await BuildingProject
        .find({ buildingManager: userId })
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

  // fetches single project by project id
  const fetchSingleProject = async (req, res) => {
    const { userId, projectId } = req.params;
    try {
      BuildingProject
        .findById(projectId)
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
        .then((project) => {
          // authenticate request by comparing userId param with buildingManager id field
          // ObjectId must be converted to string
          if (userId !== project.buildingManager._id.toString()) {
            return res.status(403).send({
              message: 'You are not authorized to view this record.',
            });
          }
          return res.status(200).send(project);
        })
        .catch(error => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };
  return { fetchAllProjects, fetchSingleProject };
};

module.exports = bmMProjectController;
