const mongoose = require('mongoose');
const buildingProject = require('../../models/bmdashboard/buildingProject');


const injuryController = function (injujrySeverity) {
  const postInjury = async (req, res) => {
    try {
      const { projectId, date, injuryType, department, severity, count } = req.body;
      // 1) fetch project to get its name
      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).send({ error: 'Invalid projectId' });
      }
      const project = await buildingProject.findById(projectId).select('name');
      if (!project) {
        return res.status(404).send({ error: 'Project not found' });
      }

      // 2) inject projectName and create
      const newRecord = await injujrySeverity.create({
        projectId,
        projectName: project.name,
        date,
        injuryType,
        department,
        severity,
        count,
      });

      res.status(201).send(newRecord);
    } catch (err) {
      console.error(err);
      res.status(500).send(err);
    }
  };

  const getInjuries = async (req, res) => {
    try {
      const { projectIds, startDate, endDate, types, departments } = req.query;

      const query = {};

      if (projectIds) {
        const projectIdArray = projectIds.split(',').map((id) => mongoose.Types.ObjectId(id));
        query.projectId = { $in: projectIdArray };
      }

      if (startDate && endDate) {
        query.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      if (types) {
        const typesArray = types.split(',');
        query.injuryType = { $in: typesArray };
      }

      if (departments) {
        const departmentsArray = departments.split(',');
        query.department = { $in: departmentsArray };
      }
      const result = await injujrySeverity.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              projectId: '$projectId',
              projectName: '$projectName',
              severity: '$severity',
            },
            totalInjuries: { $sum: '$count' },
          },
        },
        {
          $project: {
            _id: 0,
            projectId: '$_id.projectId',
            projectName: '$_id.projectName',
            severity: '$_id.severity',
            totalInjuries: 1,
          },
        },
      ]);

      res.status(200).send(result);
    } catch (err) {
      res.status(500).send(err);
    }
  };

  return { postInjury, getInjuries };
};

module.exports = injuryController;
