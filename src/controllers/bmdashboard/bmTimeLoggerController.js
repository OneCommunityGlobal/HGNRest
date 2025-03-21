// const userprofile = require('../../models/userProfile');
const mongoose = require('mongoose');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const Task = require('../../models/task');

const bmTimeLoggerController = function () {

  const fetchProjectMembers = async (req, res) => {
    // console.log("fetchProjectMembers");


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
                select: '_id firstName lastName email role teams',      
              },
            ]
          },
        )
        .exec()
        .then((project) => {
          console.log("project", project);

          project.members.forEach((member)=> {
            const userId = member.user._id;

            // console.log("userId", userId);

            try {
              Task.find(
                {
                  'resources.userID': mongoose.Types.ObjectId(userId),
                }
              ).then ((results) => {                
                // console.log("results", results);       
                if (results[0].taskName)
                {
                  const memberTaskName = results[0].taskName;  
                  // console.log("memberTaskName: ", memberTaskName);
                  // Not working because of db access latency, maybe need to implement separate signaling to fetch task name
                  // also needs to add 'task' field to insert memberTaskName rather than using teams field
                  member.user.teams[0] = memberTaskName;   
                  // console.log("member: ", member);
                }
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
