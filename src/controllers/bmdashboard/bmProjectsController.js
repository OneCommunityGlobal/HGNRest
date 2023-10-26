const mongoose = require('mongoose');

const bmMProjectsController = function (UserProfile) {
  const bmProjectsSummary = async function _projSumm(req, res) {
    const { userId } = req.params;
    try {
      const projectData = await UserProfile
        // fetch user profile, return only projects array
        .findOne({ _id: userId }, { projects: 1 })
        // populate data with projects documents using the ObjectId in the projects array
        .populate({
          path: 'projects',
          // limit to projects with category value 'Housing'
          match: { category: 'Housing' },
          // returns only these fields
          select: '_id projectName isActive createdDatetime',
        })
        .exec()
        .then(result => result.projects)
        .catch(error => res.status(500).send(error));

      // for each project, find all materials in the project
      res.status(200).send(projectData);
    } catch (err) {
      res.json(err);
    }
  };
  return { bmProjectsSummary };
};

module.exports = bmMProjectsController;
