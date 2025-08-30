const mongoose = require('mongoose');
const SupplierPerformance = require('../../models/summaryDashboard/supplierPerformance');
const logger = require('../../startup/logger');

const supplierPerformanceController = function () {
  /**
   * Get supplier performance records for a specific project and date range, or all projects
   */
  const getSupplierPerformance = async function (req, res) {
    try {
      const { projectId, startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).send('Missing required query parameters: startDate, endDate');
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      // Build match criteria - if projectId is not provided or is 'all', get data for all projects
      const matchCriteria = {
        startDate: { $lte: end },
        endDate: { $gte: start },
      };

      if (projectId && projectId !== 'all') {
        matchCriteria.projectId = mongoose.Types.ObjectId(projectId);
        console.log('Fetching data for specific project:', projectId);
      } else {
        console.log('Fetching data for all projects');
      }

      console.log('Query params:', { projectId, startDate, endDate, start, end });
      console.log('Match criteria:', matchCriteria);

      // MongoDB Aggregation Pipeline
      const supplierData = await SupplierPerformance.aggregate([
        {
          $match: matchCriteria,
        },
        {
          $group: {
            _id: '$supplierName',
            onTimeDeliveryPercentage: { $avg: '$onTimeDeliveryPercentage' },
          },
        },
        {
          $project: {
            supplierName: '$_id',
            onTimeDeliveryPercentage: { $round: ['$onTimeDeliveryPercentage', 2] },
          },
        },
        { $sort: { onTimeDeliveryPercentage: -1 } },
      ]);

      console.log('Aggregation result:', supplierData);
      res.status(200).send(supplierData);
    } catch (error) {
      logger.logException(error);
      res.status(500).send('Error fetching supplier performance data. Please try again.');
    }
  };

  /**
   * Get all unique projects that have supplier performance data
   */
  const getProjectsWithSupplierData = async function (req, res) {
    try {
      console.log('Fetching projects with supplier performance data');

      // Get distinct project IDs from supplier performance records only
      const projectsWithData = await SupplierPerformance.aggregate([
        {
          $group: {
            _id: '$projectId',
          },
        },
        {
          $project: {
            _id: 1,
            projectId: '$_id',
          },
        },
        { $sort: { _id: 1 } },
      ]);

      console.log(`Found ${projectsWithData.length} projects with supplier data`);
      res.status(200).send(projectsWithData);
    } catch (error) {
      logger.logException(error);
      res.status(500).send('Error fetching projects with supplier data. Please try again.');
    }
  };

  /**
   * Add a new supplier performance record
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
      res.status(201).send('Supplier performance record created successfully.');
    } catch (error) {
      logger.logException(error);
      res.status(500).send('Error saving supplier performance data. Please try again.');
    }
  };

  /**
   * Delete supplier performance records by Project ID
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
        res.status(200).send(`Successfully deleted ${result.deletedCount} record(s).`);
      } else {
        res.status(404).send('No records found for the specified project.');
      }
    } catch (error) {
      logger.logException(error);
      res.status(500).send('Error deleting supplier performance data. Please try again.');
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
