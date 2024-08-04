/* eslint-disable prefer-destructuring */
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
      BuildingProject.aggregate([
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
          proj.mostMaterialWaste = proj.materials.sort((a, b) => b.stockWasted - a.stockWasted)[0];
          proj.leastMaterialAvailable = proj.materials.sort((a, b) => a.stockAvailable - b.stockAvailable)[0];
          proj.mostMaterialBought = proj.materials.sort((a, b) => b.stockBought - a.stockBought)[0];
        });
        res.status(200).send(results);
      })
      .catch(error => res.status(500).send(error));
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
