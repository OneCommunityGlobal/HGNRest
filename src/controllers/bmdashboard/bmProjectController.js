/* eslint-disable prefer-destructuring */
const mongoose = require('mongoose');
const Task = require('../../models/task');
// TODO: uncomment when executing auth checks
// const jwt = require('jsonwebtoken');
// const config = require('../../config');

const bmMProjectController = function (BuildingProjectModel) {
  // TODO: uncomment when executing auth checks
  // const { JWT_SECRET } = config;

  const fetchAllProjects = async (req, res) => {
    //! Note: for easier testing this route currently returns all projects from the db
    // TODO: uncomment the lines below to return only projects where field buildingManager === userid
    // const token = req.headers.authorization;
    // const { userid } = jwt.verify(token, JWT_SECRET);
    try {
      BuildingProjectModel.aggregate([
        {
          $match: { isActive: true },
        },
        {
          $lookup: {
            from: 'userProfiles',
            let: { id: '$buildingManager' },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$id'] } } },
              { $project: { firstName: 1, lastName: 1, email: 1 } },
            ],
            as: 'buildingManager',
          },
        },
        { $unwind: '$buildingManager' },
        {
          $lookup: {
            from: 'buildingInventoryItems',
            let: { id: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$project', '$$id'] } } },
              { $match: { __t: 'material_item' } },
              { $project: { updateRecord: 0, project: 0 } },
              {
                $lookup: {
                  from: 'buildingInventoryTypes',
                  localField: 'itemType',
                  foreignField: '_id',
                  as: 'itemType',
                },
              },
              {
                $unwind: '$itemType',
              },
            ],
            as: 'materials',
          },
        },
        {
          $project: {
            name: 1,
            isActive: 1,
            template: 1,
            location: 1,
            dateCreated: 1,
            buildingManager: 1,
            teams: 1,
            members: 1,
            materials: 1,
            hoursWorked: { $sum: '$members.hours' },
            // cost values can be calculated once a process for purchasing inventory is created
            totalMaterialsCost: { $sum: 1500 },
            totalEquipmentCost: { $sum: 3000 },
          },
        },
      ])
        .then((results) => {
          results.forEach((proj) => {
            proj.mostMaterialWaste = proj.materials.sort(
              (a, b) => b.stockWasted - a.stockWasted,
            )[0];
            proj.leastMaterialAvailable = proj.materials.sort(
              (a, b) => a.stockAvailable - b.stockAvailable,
            )[0];
            proj.mostMaterialBought = proj.materials.sort(
              (a, b) => b.stockBought - a.stockBought,
            )[0];
          });
          res.status(200).send(results);
        })
        .catch((error) => res.status(500).send(error));
    } catch (err) {
      res.status(500).send(err);
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
      BuildingProjectModel.findById(projectId)
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
        .then((project) => res.status(200).send(project))
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
        .catch((error) => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };

  const fetchProjectsNames = async (req, res) => {
    try {
      const projects = await BuildingProjectModel.find(
        { isActive: true }, // only active projects
        { _id: 1, name: 1 }, // only select id + name
      );

      const projectNames = projects.map((proj) => ({
        projectId: proj._id,
        projectName: proj.name,
      }));

      res.status(200).json(projectNames);
    } catch (error) {
      console.error('Error in fetchProjectNames:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  const fetchProjectMembers = async (req, res) => {
    const { projectId } = req.params;
    try {
      BuildingProjectModel.findById(projectId)
        .populate({ path: 'buildingManager', select: '_id firstName lastName email' })
        // .populate({
        //   path: 'teams',
        //   select: '_id teamName'
        // })
        .populate({
          path: 'members',
          populate: [
            {
              path: 'user',
              select: '_id firstName lastName email role teams',
            },
          ],
        })
        .exec()
        .then((project) => {
          project.members.forEach((member) => {
            const userId = member.user._id;
            try {
              Task.find({
                'resources.userID': new mongoose.Types.ObjectId(userId),
              }).then((results) => {
                // console.log("results", results);
                if (results[0]?.taskName) {
                  const memberTaskName = results[0].taskName;
                  // console.log("memberTaskName: ", memberTaskName);
                  // Not working because of db access latency, maybe need to implement separate signaling to fetch task name
                  // also needs to add 'task' field to insert memberTaskName rather than using teams field
                  member.user.teams[0] = memberTaskName;
                  // console.log("member: ", member);
                }
              });
            } catch (error) {
              console.log('error');
            }
          });
          return project;
        })
        .then((project) => res.status(200).send(project))
        .catch((error) => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };

  return { fetchAllProjects, fetchSingleProject, fetchProjectsNames, fetchProjectMembers };
};

module.exports = bmMProjectController;
