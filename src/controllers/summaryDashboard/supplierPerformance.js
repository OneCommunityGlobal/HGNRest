const mongoose = require('mongoose');
const Project = require('../../models/bmdashboard/buildingProject');
const BuildingMaterial = require('../../models/bmdashboard/buildingMaterial');
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

      if (projectId && projectId !== 'all' && !mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).send('Invalid projectId.');
      }

      const start = new Date(`${startDate}T00:00:00.000Z`);
      const end = new Date(`${endDate}T23:59:59.999Z`);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        return res.status(400).send('Invalid date range.');
      }

      const matchCriteria = {};

      if (projectId && projectId !== 'all') {
        matchCriteria.project = new mongoose.Types.ObjectId(projectId);
      }

      const supplierData = await BuildingMaterial.aggregate([
        { $match: matchCriteria },
        { $unwind: '$purchaseRecord' },
        {
          $match: {
            'purchaseRecord.status': 'Received',
            'purchaseRecord.supplier': { $type: 'objectId' },
            'purchaseRecord.expectedDeliveryDate': { $type: 'date' },
            'purchaseRecord.actualDeliveryDate': {
              $gte: start,
              $lte: end,
            },
          },
        },
        {
          $lookup: {
            from: 'buildingSuppliers',
            localField: 'purchaseRecord.supplier',
            foreignField: '_id',
            as: 'supplierDetails',
          },
        },
        { $unwind: '$supplierDetails' },
        {
          $group: {
            _id: '$purchaseRecord.supplier',
            supplierName: { $first: '$supplierDetails.name' },
            totalDeliveries: { $sum: 1 },
            onTimeDeliveries: {
              $sum: {
                $cond: [
                  {
                    $lte: [
                      {
                        $dateTrunc: {
                          date: '$purchaseRecord.actualDeliveryDate',
                          unit: 'day',
                          timezone: 'UTC',
                        },
                      },
                      {
                        $dateTrunc: {
                          date: '$purchaseRecord.expectedDeliveryDate',
                          unit: 'day',
                          timezone: 'UTC',
                        },
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            supplierName: 1,
            onTimeDeliveryPercentage: {
              $round: [
                {
                  $multiply: [{ $divide: ['$onTimeDeliveries', '$totalDeliveries'] }, 100],
                },
                2,
              ],
            },
          },
        },
        { $sort: { onTimeDeliveryPercentage: -1, supplierName: 1 } },
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
      const projectIds = await BuildingMaterial.distinct('project', {
        purchaseRecord: {
          $elemMatch: {
            status: 'Received',
            supplier: { $type: 'objectId' },
            expectedDeliveryDate: { $type: 'date' },
            actualDeliveryDate: { $type: 'date' },
          },
        },
      });

      const validProjectIds = projectIds
        .filter((id) => mongoose.isValidObjectId(id))
        .map((id) => new mongoose.Types.ObjectId(id.toString()));

      const projects = await Project.find({
        _id: { $in: validProjectIds },
      })
        .select('_id name')
        .lean();

      const results = projects
        .map((project) => ({
          _id: project._id,
          projectName: project.name || 'Unnamed Project',
        }))
        .sort((a, b) => a.projectName.localeCompare(b.projectName));

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
