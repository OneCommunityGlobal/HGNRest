/* eslint-disable no-unused-vars */
/* eslint-disable no-shadow */
/* eslint-disable prefer-destructuring */
const mongoose = require('mongoose');
const Task = require('../../models/task');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const BuildingIssue = require('../../models/bmdashboard/buildingIssue');
// TODO: uncomment when executing auth checks
// const jwt = require('jsonwebtoken');
// const config = require('../../config');

const bmMProjectController = function () {
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
            members: {
              $map: {
                input: { $ifNull: ['$members', []] },
                as: 'member',
                in: {
                  user: '$$member.user',
                  hours: '$$member.hours',
                },
              },
            },
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
      BuildingProject.findById(projectId)
        .select('-members.hourlyRate')
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
      // Query all active projects from database (unchanged)
      const projects = await BuildingProject.find(
        { isActive: true }, // only active projects
        { _id: 1, name: 1 }, // only select id + name
      );

      let projectNames = projects.map((proj) => ({
        projectId: proj._id,
        projectName: proj.name,
      }));

      // Optional filtering: only include projects that have issues
      // Used by Issues Breakdown Chart to avoid showing projects with no data
      if (req.query.withIssuesOnly === 'true') {
        // Get distinct project IDs that have issues
        const projectIdsWithIssues = await BuildingIssue.distinct('projectId');
        const projectIdsWithIssuesSet = new Set(projectIdsWithIssues.map((id) => id.toString()));

        // Filter to only include projects that have issues
        projectNames = projectNames.filter((proj) =>
          projectIdsWithIssuesSet.has(proj.projectId.toString()),
        );
      }

      res.status(200).json(projectNames);
    } catch (error) {
      console.error('Error in fetchProjectNames:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };

  const fetchProjectMembers = async (req, res) => {
    const { projectId } = req.params;
    try {
      BuildingProject.findById(projectId)
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
                'resources.userID': mongoose.Types.ObjectId(userId),
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
  const fetchProjectHourlyRates = async (req, res) => {
    const { projectId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID.' });
    }

    try {
      const project = await BuildingProject.findById(projectId)
        .select('buildingManager members')
        .populate('members.user', 'firstName lastName');

      if (!project) {
        return res.status(404).json({ message: 'Project not found.' });
      }

      if (
        req.user.role !== 'Owner' &&
        String(project.buildingManager) !== String(req.user.userid)
      ) {
        return res.status(403).json({ message: 'Access denied for this project.' });
      }

      const members = project.members.map((member) => ({
        userId: member.user?._id,
        firstName: member.user?.firstName,
        lastName: member.user?.lastName,
        hourlyRate: member.hourlyRate ?? null,
      }));

      return res.status(200).json({ members });
    } catch (error) {
      return res.status(500).json({ message: 'Unable to fetch hourly rates.' });
    }
  };
  const updateMemberHourlyRate = async (req, res) => {
    const { projectId, memberId } = req.params;
    const { hourlyRate } = req.body;

    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(memberId)) {
      return res.status(400).json({ message: 'Invalid project or member ID.' });
    }

    if (
      hourlyRate === null ||
      typeof hourlyRate !== 'number' ||
      !Number.isFinite(hourlyRate) ||
      hourlyRate < 0
    ) {
      return res.status(400).json({ message: 'Hourly rate must be a non-negative number.' });
    }

    try {
      const project = await BuildingProject.findById(projectId).select('buildingManager');
      if (!project) {
        return res.status(404).json({ message: 'Project not found.' });
      }

      if (
        req.user.role !== 'Owner' &&
        String(project.buildingManager) !== String(req.user.userid)
      ) {
        return res.status(403).json({ message: 'Access denied for this project.' });
      }
      const updatedProject = await BuildingProject.findOneAndUpdate(
        { _id: projectId, 'members.user': memberId },
        { $set: { 'members.$.hourlyRate': hourlyRate } },
        { new: true, runValidators: true },
      );

      if (!project) {
        return res.status(404).json({ message: 'Project or member not found.' });
      }

      return res.status(200).json({ message: 'Hourly rate updated successfully.' });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to update hourly rate.' });
    }
  };
  const updateTaskLaborBudget = async (req, res) => {
    const { projectId } = req.params;
    const { task, budget } = req.body;

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID.' });
    }

    if (typeof task !== 'string' || !task.trim()) {
      return res.status(400).json({ message: 'Task name is required.' });
    }

    if (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 0) {
      return res.status(400).json({ message: 'Budget must be a non-negative number.' });
    }

    try {
      const project = await BuildingProject.findById(projectId);

      if (!project) {
        return res.status(404).json({ message: 'Project not found.' });
      }
      if (
        req.user.role !== 'Owner' &&
        String(project.buildingManager) !== String(req.user.userid)
      ) {
        return res.status(403).json({ message: 'Access denied for this project.' });
      }

      const taskName = task.trim();

      const existingBudget = project.laborBudgets.find((item) => item.task === taskName);

      if (existingBudget) {
        existingBudget.budget = budget;
      } else {
        project.laborBudgets.push({ task: taskName, budget });
      }

      await project.save();

      return res.status(200).json({
        message: 'Task labor budget updated successfully.',
        laborBudgets: project.laborBudgets,
      });
    } catch (error) {
      return res.status(500).json({ message: 'Failed to update task labor budget.' });
    }
  };
  return {
    fetchAllProjects,
    fetchSingleProject,
    fetchProjectsNames,
    fetchProjectMembers,
    fetchProjectHourlyRates,
    updateMemberHourlyRate,
    updateTaskLaborBudget,
  };
};

module.exports = bmMProjectController;
