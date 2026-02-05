const mongoose = require('mongoose');
const UserProfile = require('../../models/userProfile');
const Task = require('../../models/task');
const BuildingProject = require('../../models/bmdashboard/buildingProject');
const WBS = require('../../models/wbs');
const ExternalTeam = require('../../models/bmdashboard/buildingExternalTeam');

const bmWorkforceSkillGapController = function () {
  const getWorkforceSkillGap = async (req, res) => {
    try {
      const { projectId } = req.query;
      const DEFAULT_WEEKLY_HOURS = 40;
      let availableHours = [];
      let projectFilter = { isActive: true };

      // 1. Calculate Available Hours (Capacity) from External Teams
      // Simplified: Just aggregate all ExternalTeam members by role, assign to "All Projects"

      if (projectId && projectId !== 'All' && mongoose.Types.ObjectId.isValid(projectId)) {
        projectFilter = { ...projectFilter, _id: mongoose.Types.ObjectId(projectId) };

        // Get the project name
        const project = await BuildingProject.findById(projectId);
        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }

        // Aggregate External Teams by role for this project
        availableHours = await ExternalTeam.aggregate([
          {
            $group: {
              _id: {
                project: project.name,
                department: { $ifNull: ['$role', 'Unassigned'] },
              },
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              available: { $multiply: ['$count', DEFAULT_WEEKLY_HOURS] },
            },
          },
        ]);
      } else {
        // For "All" projects view, aggregate by role across all external teams
        const projects = await BuildingProject.find({ isActive: true });

        // Get all external teams and assign to first active project (simplified)
        const externalTeams = await ExternalTeam.find({});

        const aggMap = {};

        externalTeams.forEach((et) => {
          // Assign all external teams to first project for simplicity
          const projName = projects.length > 0 ? projects[0].name : 'Unassigned Project';
          const role = et.role || 'Unassigned';
          const key = `${projName}|${role}`;

          if (!aggMap[key]) aggMap[key] = { project: projName, department: role, available: 0 };
          aggMap[key].available += DEFAULT_WEEKLY_HOURS;
        });

        availableHours = Object.values(aggMap).map((item) => ({
          _id: { project: item.project, department: item.department },
          available: item.available,
        }));
      }

      // 2. Calculate Required Hours (Demand) from Tasks
      // Simplified: Use task category as the role/department

      const requiredHours = await Task.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: 'wbs',
            localField: 'wbsId',
            foreignField: '_id',
            as: 'wbs',
          },
        },
        { $unwind: '$wbs' },
        {
          $lookup: {
            from: 'buildingProjects',
            let: { projectId: '$wbs.projectId' },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$projectId'] } } },
              { $match: projectFilter },
            ],
            as: 'project',
          },
        },
        { $unwind: '$project' },
        {
          $group: {
            _id: {
              project: '$project.name',
              department: { $ifNull: ['$category', 'General'] },
            },
            required: { $sum: '$estimatedHours' },
          },
        },
      ]);

      // 3. Merge Data into flat array
      const map = new Map();

      availableHours.forEach((item) => {
        const key = `${item._id.project}|${item._id.department}`;
        if (!map.has(key)) {
          map.set(key, {
            project: item._id.project,
            department: item._id.department,
            required: 0,
            available: 0,
          });
        }
        map.get(key).available = item.available;
      });

      requiredHours.forEach((item) => {
        const key = `${item._id.project}|${item._id.department}`;
        if (!map.has(key)) {
          map.set(key, {
            project: item._id.project,
            department: item._id.department,
            required: 0,
            available: 0,
          });
        }
        map.get(key).required = item.required;
      });

      const result = Array.from(map.values());

      res.status(200).json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  };

  return { getWorkforceSkillGap };
};

module.exports = bmWorkforceSkillGapController;
