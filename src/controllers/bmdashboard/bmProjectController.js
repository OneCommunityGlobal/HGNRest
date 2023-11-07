// TODO: uncomment when executing auth checks
// const jwt = require('jsonwebtoken');
// const config = require('../../config');

const bmMProjectController = function (BuildingProject) {
  // TODO: uncomment when executing auth checks
  // const { JWT_SECRET } = config;

  const fetchAllProjects = async (req, res) => {
    //! Note: for easier testing this route currently returns all projects from the db
    // TODO: uncomment the lines below to return only projects where field buildingManager === userid
    // const token = req.headers.authorization;
    // const { userid } = jwt.verify(token, JWT_SECRET);
    try {
      const projectData = await BuildingProject
        // TODO: uncomment this line to filter by buildingManager field
        // .find({ buildingManager: userid })
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

  // fetches single project by project id
  const fetchSingleProject = async (req, res) => {
    //! Note: for easier testing this route currently returns the project without an auth check
    // TODO: uncomment the lines below to check the user's ability to view the current project
    // const token = req.headers.authorization;
    // const { userid } = jwt.verify(token, JWT_SECRET);
    const { projectId } = req.params;
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
        .then(project => res.status(200).send(project))
        // TODO: uncomment this block to execute the auth check
        // authenticate request by comparing userId param with buildingManager id field
        // Note: _id has type object and must be converted to string
        // .then((project) => {
        //   if (userid !== project.buildingManager._id.toString()) {
        //     return res.status(403).send({
        //       message: 'You are not authorized to view this record.',
        //     });
        //   }
        //   return res.status(200).send(project);
        // })
        .catch(error => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };
  return { fetchAllProjects, fetchSingleProject };
};

module.exports = bmMProjectController;
