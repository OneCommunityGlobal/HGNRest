const mongoose = require('mongoose');
const Project = require('../../models/project');
const SupplierPerformance = require('../../models/summaryDashboard/supplierPerformance');
const logger = require('../../startup/logger');

const supplierPerformanceController = function () {
  /**
   * Get supplier performance records for a specific project and date range,
   * or all projects.
   */
  const getSupplierPerformance = async function (req, res) {
    try {
      const { projectId, startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).send('Missing required query parameters: startDate, endDate');
      }

      // Validate projectId before converting it to a MongoDB ObjectId.
      // "all" is a valid special value used by the frontend.
      if (projectId && projectId !== 'all' && !mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).send('Invalid projectId.');
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      const matchCriteria = {
        startDate: { $lte: end },
        endDate: { $gte: start },
      };

      if (projectId && projectId !== 'all') {
        matchCriteria.projectId = mongoose.Types.ObjectId(projectId);
      }

      const supplierData = await SupplierPerformance.aggregate([
        {
          $match: matchCriteria,
        },
        {
          $group: {
            _id: '$supplierName',
            onTimeDeliveryPercentage: {
              $avg: '$onTimeDeliveryPercentage',
            },
          },
        },
        {
          $project: {
            supplierName: '$_id',
            onTimeDeliveryPercentage: {
              $round: ['$onTimeDeliveryPercentage', 2],
            },
          },
        },
        {
          $sort: {
            onTimeDeliveryPercentage: -1,
          },
        },
      ]);

      return res.status(200).send(supplierData);
    } catch (error) {
      logger.logException(error);
      return res.status(500).send('Error fetching supplier performance data. Please try again.');
    }
  };

  /**
   * Get all unique projects that have supplier performance data.
   * Project names are returned along with their IDs so that the
   * frontend dropdown can display project names instead of raw IDs.
   */
  const getProjectsWithSupplierData = async function (req, res) {
    try {
      const projectIds = await SupplierPerformance.distinct('projectId');

      const validProjectIds = projectIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(String(id)));

      if (validProjectIds.length === 0) {
        return res.status(200).send([]);
      }

      const projects = await Project.find({
        _id: { $in: validProjectIds },
      })
        .select('_id projectName')
        .lean();

      const projectNames = new Map(
        projects.map((project) => [String(project._id), project.projectName]),
      );

      const results = validProjectIds.map((id) => {
        const idString = String(id);
        const projectName = projectNames.get(idString);

        return {
          _id: id,
          projectName: projectName || `Unknown project (…${idString.slice(-4)})`,
        };
      });

      results.sort((a, b) => a.projectName.localeCompare(b.projectName));

      return res.status(200).send(results);
    } catch (error) {
      logger.logException(error);
      return res.status(500).send('Error fetching projects with supplier data. Please try again.');
    }
  };

  /**
   * Add a new supplier performance record.
   */
  const postSupplierPerformance = async function (req, res) {
    try {
      const { supplierName, onTimeDeliveryPercentage, projectId, startDate, endDate } = req.body;

      if (!supplierName || !onTimeDeliveryPercentage || !projectId || !startDate || !endDate) {
        return res
          .status(400)
          .send(
            'All fields are required: supplierName, onTimeDeliveryPercentage, projectId, startDate, endDate',
          );
      }

      const newRecord = new SupplierPerformance({
        supplierName,
        onTimeDeliveryPercentage,
        projectId: mongoose.Types.ObjectId(projectId),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });

      await newRecord.save();

      return res.status(201).send('Supplier performance record created successfully.');
    } catch (error) {
      logger.logException(error);
      return res.status(500).send('Error saving supplier performance data. Please try again.');
    }
  };

  /**
   * Delete supplier performance records by Project ID.
   */
  const deleteSupplierPerformanceByProject = async function (req, res) {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        return res.status(400).send('Project ID is required.');
      }

      const result = await SupplierPerformance.deleteMany({
        projectId: mongoose.Types.ObjectId(projectId),
      });

      if (result.deletedCount > 0) {
        return res.status(200).send(`Successfully deleted ${result.deletedCount} record(s).`);
      }

      return res.status(404).send('No records found for the specified project.');
    } catch (error) {
      logger.logException(error);
      return res.status(500).send('Error deleting supplier performance data. Please try again.');
    }
  };

  return {
    getSupplierPerformance,
    getProjectsWithSupplierData,
    postSupplierPerformance,
    deleteSupplierPerformanceByProject,
  };
};

module.exports = supplierPerformanceController;
