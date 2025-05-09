/* eslint-disable quotes */
/* eslint-disable arrow-parens */
const mongoose = require('mongoose');
const SupplierPerformance = require('../../models/summaryDashboard/supplierPerformance.js');
const logger = require('../../startup/logger.js');

const supplierPerformanceController = function () {
    // Mock data for testing
    // TO DO : Once we populate, the supplier performance table, we can send supplierData instead of mockData
    const mockData = [
    { supplierName: 'Supplier A', onTimeDeliveryPercentage: 95 },
    { supplierName: 'Supplier B', onTimeDeliveryPercentage: 88 },
    { supplierName: 'Supplier C', onTimeDeliveryPercentage: 82 },
    { supplierName: 'Supplier D', onTimeDeliveryPercentage: 78 },
  ];
  /**
   * Get all supplier performance records for a specific project and date range
   */
  const getSupplierPerformance = async function (req, res) {
    try {
    //   const { projectId, startDate, endDate } = req.query;

    //   if (!projectId || !startDate || !endDate) {
    //     return res.status(400).send('Missing required query parameters.');
    //   }

    //   const start = new Date(startDate);
    //   const end = new Date(endDate);

    //   // MongoDB Aggregation Pipeline
    //   const supplierData = await SupplierPerformance.aggregate([
    //     {
    //       $match: {
    //         projectId: mongoose.Types.ObjectId(projectId),
    //         date: { $gte: start, $lte: end },
    //       },
    //     },
    //     {
    //       $group: {
    //         _id: '$supplierName',
    //         onTimeDeliveryPercentage: { $avg: '$onTimeDeliveryPercentage' },
    //       },
    //     },
    //     {
    //       $project: {
    //         supplierName: '$_id',
    //         onTimeDeliveryPercentage: { $round: ['$onTimeDeliveryPercentage', 2] },
    //       },
    //     },
    //     { $sort: { onTimeDeliveryPercentage: -1 } },
    //   ]);

    //   res.status(200).send(supplierData);
     res.status(200).send(mockData);
    } catch (error) {
      logger.logException(error);
      res.status(500).send('Error fetching supplier performance data. Please try again.');
    }
  };

  /**
   * Add a new supplier performance record
   */
  const postSupplierPerformance = async function (req, res) {
    try {
      const { supplierName, onTimeDeliveryPercentage, projectId, date } = req.body;

      if (!supplierName || !onTimeDeliveryPercentage || !projectId || !date) {
        return res.status(400).send('All fields are required.');
      }

      const newRecord = new SupplierPerformance({
        supplierName,
        onTimeDeliveryPercentage,
        projectId: mongoose.Types.ObjectId(projectId),
        date: new Date(date),
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

      const result = await SupplierPerformance.deleteMany({ projectId: mongoose.Types.ObjectId(projectId) });

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
    postSupplierPerformance,
    deleteSupplierPerformanceByProject,
  };
};

module.exports = supplierPerformanceController;
