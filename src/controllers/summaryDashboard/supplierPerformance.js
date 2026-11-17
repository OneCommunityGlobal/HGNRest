const mongoose = require('mongoose');
const Project = require('../../models/project');
const SupplierPerformance = require('../../models/summaryDashboard/supplierPerformance');
const RootCause = require('../../models/summaryDashboard/supplierRootCause');
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

      if (
        !supplierName ||
        onTimeDeliveryPercentage == null ||
        !projectId ||
        !startDate ||
        !endDate
      ) {
        return res
          .status(400)
          .send(
            'All fields are required: supplierName, onTimeDeliveryPercentage, projectId, startDate, endDate',
          );
      }

      if (
        !mongoose.Types.ObjectId.isValid(projectId) ||
        typeof onTimeDeliveryPercentage !== 'number' ||
        !Number.isFinite(onTimeDeliveryPercentage) ||
        onTimeDeliveryPercentage < 0 ||
        onTimeDeliveryPercentage > 100 ||
        !Number.isFinite(+new Date(startDate)) ||
        !Number.isFinite(+new Date(endDate)) ||
        new Date(startDate) > new Date(endDate) ||
        (req.body.slaTarget != null &&
          (typeof req.body.slaTarget !== 'number' ||
            !Number.isFinite(req.body.slaTarget) ||
            req.body.slaTarget < 0 ||
            req.body.slaTarget > 100)) ||
        (req.body.supplierId != null &&
          (typeof req.body.supplierId !== 'string' || !req.body.supplierId.trim()))
      ) {
        return res
          .status(400)
          .send('Invalid performance, dates, supplier ID, SLA target or project ID.');
      }
      const newRecord = new SupplierPerformance({
        supplierName,
        supplierId: req.body.supplierId,
        slaTarget: req.body.slaTarget,
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

  // History uses observation end dates: overlapping intervals are never split into invented records.
  const getAnalytics = async (req, res) => {
    const { startDate, endDate, projectId = 'all' } = req.query;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate || '') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate || '') ||
      !Number.isFinite(+start) ||
      !Number.isFinite(+end) ||
      start.toISOString().slice(0, 10) !== startDate ||
      end.toISOString().slice(0, 10) !== endDate ||
      start > end ||
      (projectId !== 'all' && !mongoose.Types.ObjectId.isValid(projectId))
    ) {
      return res.status(400).send('Invalid date range or project ID.');
    }
    end.setUTCHours(23, 59, 59, 999);
    try {
      const criteria = { endDate: { $gte: start, $lte: end } };
      if (projectId !== 'all') criteria.projectId = mongoose.Types.ObjectId(projectId);
      const records = await SupplierPerformance.find(criteria).lean();
      const keys = [
        ...new Set(
          records.map((r) => (r.supplierId ? `id:${r.supplierId}` : `name:${r.supplierName}`)),
        ),
      ];
      const causes = await RootCause.find({ supplierKey: { $in: keys } }).lean();
      return res.status(200).send({ records, causes });
    } catch (error) {
      logger.logException(error);
      return res.status(500).send('Unable to load supplier history.');
    }
  };

  const updateRootCauses = async (req, res) => {
    if (!['Administrator', 'Owner'].includes(req.user?.role)) {
      return res.status(403).send('Administrator access required.');
    }
    const { supplierKey, tags } = req.body;
    if (
      typeof supplierKey !== 'string' ||
      supplierKey.length > 250 ||
      !/^(id|name):.+/.test(supplierKey) ||
      !Array.isArray(tags) ||
      tags.length > 10 ||
      tags.some((t) => typeof t !== 'string' || !t.trim() || t.trim().length > 80)
    ) {
      return res
        .status(400)
        .send('Provide a supplier key and up to ten tags (1-80 characters each).');
    }
    try {
      const supplier = supplierKey.startsWith('id:')
        ? { supplierId: supplierKey.slice(3) }
        : { supplierName: supplierKey.slice(5), supplierId: { $in: [null, ''] } };
      if (!(await SupplierPerformance.exists(supplier)))
        return res.status(404).send('Supplier not found.');
      const result = await RootCause.findOneAndUpdate(
        { supplierKey },
        { $set: { tags: [...new Set(tags.map((t) => t.trim()))] } },
        { upsert: true, new: true, runValidators: true },
      );
      return res.status(200).send(result);
    } catch (error) {
      logger.logException(error);
      return res.status(500).send('Unable to save root causes.');
    }
  };

  return {
    getAnalytics,
    updateRootCauses,
    getSupplierPerformance,
    getProjectsWithSupplierData,
    postSupplierPerformance,
    deleteSupplierPerformanceByProject,
  };
};

module.exports = supplierPerformanceController;
