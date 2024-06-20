// const userprofile = require('../../models/userProfile');
const BuildingProject = require('../../models/bmdashboard/buildingProject')

const bmTimeLoggerController = function () {

  const fetchProjectMembers = async (req, res) => {
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
          path: 'members', 
          populate: [{
            path: 'user',
            select: '_id firstName lastName email',
          }]}])
        .exec()
        .then(project => res.status(200).send(project))
        .catch(error => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };

  return { fetchProjectMembers };
};

module.exports = bmTimeLoggerController;
