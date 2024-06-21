// const userprofile = require('../../models/userProfile');
const mongoose = require('mongoose');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const Task = require('../../models/task');

const bmTimeLoggerController = function () {

  const fetchProjectMembers = async (req, res) => {
    const { projectId } = req.params;
    try {
      BuildingProject
        .findById(projectId)
        .populate({path: 'buildingManager', select: '_id firstName lastName email'})
        // .populate({
        //   path: 'teams', 
        //   select: '_id teamName'
        // })        
        .populate(
          {
            path: 'members', 
            populate: [
              {
                path: 'user',
                select: '_id firstName lastName email teams',      
              },
            ]
          },
        )
        .exec()
        .then((project) => {
          console.log("project", project);

          project.members.forEach((member)=> {
            const userId = member.user._id;

            console.log("userId", userId);

            try {
              Task.find(
                {
                  'resources.userID': mongoose.Types.ObjectId(userId),
                }
              ).then ((results) => {
                console.log("results", results);
              })
            } catch(error)
            {console.log("error");}

          })
          return project;
        })
        .then(project => res.status(200).send(project))
        .catch(error => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };

  return { fetchProjectMembers };
};

module.exports = bmTimeLoggerController;
