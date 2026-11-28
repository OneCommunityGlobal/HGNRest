const mongoose = require('mongoose');

const bmRentalChartController = function () {
  const RentalChart = require('../../models/bmdashboard/buildingRentalChart');
  const BuildingProject = require('../../models/bmdashboard/buildingProject');

  const getAllRentalCosts = async (req, res) => {
    try {
      const rentals = await RentalChart.find({})
        .select('projectId date toolName rentalCost totalMaterialCost')
        .lean()
        .exec();

      const transformedRentals = rentals.map((rental) => ({
        projectId: rental.projectId,
        date: rental.date,
        toolName: rental.toolName,
        rentalCost: rental.rentalCost,
        totalMaterialCost: rental.totalMaterialCost,
      }));

      return res.status(200).json({
        success: true,
        count: transformedRentals.length,
        data: transformedRentals,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: `Server error ${err.message}`,
      });
    }
  };

  const getRentalCostOverTime = async (req, res) => {
    try {
      const { projectId, startDate, endDate } = req.query;

      const match = {};

      if (projectId) {
        if (!mongoose.Types.ObjectId.isValid(projectId)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid projectId',
          });
        }

        match.projectId = {
          $in: [projectId, new mongoose.Types.ObjectId(projectId)],
        };
      }

      if (startDate || endDate) {
        match.date = {};

        if (startDate) {
          match.date.$gte = new Date(startDate);
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setUTCHours(23, 59, 59, 999);
          match.date.$lte = end;
        }
      }

      const data = await RentalChart.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$date',
              },
            },
            value: {
              $sum: '$rentalCost',
            },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            date: '$_id',
            value: 1,
          },
        },
      ]);

      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: `Server error ${err.message}`,
      });
    }
  };

  const getToolsCostBreakdown = async (req, res) => {
    try {
      const { projects, startDate, endDate } = req.query;

      const match = {};

      if (projects) {
        const projectIds = projects
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean);

        const hasInvalidProjectId = projectIds.some((id) => !mongoose.Types.ObjectId.isValid(id));

        if (hasInvalidProjectId) {
          return res.status(400).json({
            success: false,
            error: 'One or more project IDs are invalid',
          });
        }

        match.projectId = {
          $in: projectIds.flatMap((id) => [id, new mongoose.Types.ObjectId(id)]),
        };
      }

      if (startDate || endDate) {
        match.date = {};

        if (startDate) {
          match.date.$gte = new Date(startDate);
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setUTCHours(23, 59, 59, 999);
          match.date.$lte = end;
        }
      }

      const costs = await RentalChart.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $toString: '$projectId' },
            rentedToolsCost: {
              $sum: '$rentalCost',
            },
            totalToolsCost: {
              $sum: '$totalMaterialCost',
            },
          },
        },
      ]);

      const projectIds = costs
        .map((item) => item._id)
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      const projectDocuments = await BuildingProject.find({
        _id: { $in: projectIds },
      })
        .select('_id name')
        .lean();

      const projectNames = new Map(
        projectDocuments.map((project) => [project._id.toString(), project.name]),
      );

      const data = costs.map((item) => ({
        projectId: item._id,
        projectName: projectNames.get(item._id.toString()) || 'Unknown Project',
        ownedToolsCost: Math.max(0, item.totalToolsCost - item.rentedToolsCost),
        rentedToolsCost: item.rentedToolsCost,
      }));

      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: `Server error ${err.message}`,
      });
    }
  };

  return {
    getAllRentalCosts,
    getRentalCostOverTime,
    getToolsCostBreakdown,
  };
};

module.exports = bmRentalChartController;
