const bmDashboardPrototypeController = function (
  DashboardMetrics,
  BuildingProject,
  BuildingMaterial,
) {
  /**
   * Helper function to generate dashboard metrics
   */
  const generateDashboardMetrics = async () => {
    try {
      // Get project statistics using isActive field
      const totalProjects = await BuildingProject.countDocuments();
      const activeProjects = await BuildingProject.countDocuments({ isActive: true });

      // For "delayed" projects, we'll use projects that have been active for more than 90 days as a proxy
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const delayedProjects = await BuildingProject.countDocuments({
        isActive: true,
        dateCreated: { $lt: ninetyDaysAgo },
      });

      // Completed projects are those with isActive=false
      const completedProjects = await BuildingProject.countDocuments({ isActive: false });

      // Get previous week metrics for trend calculation
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const previousWeekMetrics = await DashboardMetrics.findOne({
        date: { $gte: oneWeekAgo },
        snapshotType: 'weekly',
      })
        .sort({ date: 1 })
        .lean();

      const previousMonthMetrics = await DashboardMetrics.findOne({
        date: { $gte: oneMonthAgo, $lt: oneWeekAgo },
        snapshotType: 'monthly',
      })
        .sort({ date: 1 })
        .lean();

      // Calculate material usage from BuildingMaterial collection
      const materialStats = await BuildingMaterial.aggregate([
        {
          $group: {
            _id: null,
            totalMaterialUsed: { $sum: '$stockUsed' },
            materialWasted: { $sum: '$stockWasted' },
            materialAvailable: { $sum: '$stockAvailable' },
            stockBought: { $sum: '$stockBought' },
          },
        },
      ]);

      // For material costs, we'll need to add cost information to the materials
      // For the prototype, we'll use an average cost per unit based on material type
      // In a real implementation, this would come from the purchase price
      const avgCostPerUnit = 50; // Placeholder for average cost

      const materialCostEstimate =
        materialStats.length > 0 ? materialStats[0].stockBought * avgCostPerUnit : 27600;

      // Calculate total labor hours and estimate cost
      const laborStats = await BuildingProject.aggregate([
        {
          $unwind: '$members',
        },
        {
          $group: {
            _id: null,
            totalLaborHours: { $sum: '$members.hours' },
          },
        },
      ]);

      const avgHourlyRate = 25; // Placeholder for hourly rate
      const laborCostEstimate =
        laborStats.length > 0 ? laborStats[0].totalLaborHours * avgHourlyRate : 18400;

      // Calculate average project duration based on labor hours
      // For a more accurate average, divide total hours by completed projects
      let avgProjectDuration = 0;
      if (completedProjects > 0 && laborStats.length > 0) {
        avgProjectDuration = laborStats[0].totalLaborHours / completedProjects;
      } else {
        avgProjectDuration = 1754; // Default to 1754 hrs as shown in UI
      }

      // Extract values from aggregation results or use defaults from UI
      const materialData =
        materialStats.length > 0
          ? materialStats[0]
          : {
              totalMaterialUsed: 2714,
              materialWasted: 879,
              materialAvailable: 693,
              stockBought: 2714 + 879 + 693, // Total of used, wasted, and available
            };

      // For "material used" in the second card, use a calculated value
      const secondaryMaterialUsed = Math.round(materialData.totalMaterialUsed * 0.42); // ~42% of total

      // Calculate trend percentages
      const calculateTrend = (current, previous) => {
        if (!previous || previous === 0) return 0;
        return parseFloat((((current - previous) / previous) * 100).toFixed(1));
      };

      // Create metrics object with trends
      const metrics = {
        totalProjects: {
          value: totalProjects || 426, // Default from UI
          trend: {
            value: previousWeekMetrics?.metrics?.totalProjects?.value
              ? calculateTrend(totalProjects, previousWeekMetrics.metrics.totalProjects.value)
              : 16,
            period: 'week',
          },
        },
        completedProjects: {
          value: completedProjects || 127, // Default from UI
          trend: {
            value: previousWeekMetrics?.metrics?.completedProjects?.value
              ? calculateTrend(
                  completedProjects,
                  previousWeekMetrics.metrics.completedProjects.value,
                )
              : 14,
            period: 'week',
          },
        },
        delayedProjects: {
          value: delayedProjects || 34, // Default from UI
          trend: {
            value: previousWeekMetrics?.metrics?.delayedProjects?.value
              ? calculateTrend(delayedProjects, previousWeekMetrics.metrics.delayedProjects.value)
              : -18,
            period: 'week',
          },
        },
        activeProjects: {
          value: activeProjects || 265, // Default from UI
          trend: {
            value: previousWeekMetrics?.metrics?.activeProjects?.value
              ? calculateTrend(activeProjects, previousWeekMetrics.metrics.activeProjects.value)
              : 3,
            period: 'week',
          },
        },
        avgProjectDuration: {
          value: Math.round(avgProjectDuration) || 1754, // Default from UI
          trend: {
            value: previousWeekMetrics?.metrics?.avgProjectDuration?.value
              ? calculateTrend(
                  avgProjectDuration,
                  previousWeekMetrics.metrics.avgProjectDuration.value,
                )
              : 13,
            period: 'week',
          },
        },
        totalMaterialCost: {
          value: parseFloat((materialCostEstimate / 1000).toFixed(1)) || 27.6, // $27.6K from UI
          trend: {
            value: previousWeekMetrics?.metrics?.totalMaterialCost?.value
              ? calculateTrend(
                  materialCostEstimate / 1000,
                  previousWeekMetrics.metrics.totalMaterialCost.value,
                )
              : 9,
            period: 'week',
          },
        },
        totalLaborCost: {
          value: parseFloat((laborCostEstimate / 1000).toFixed(1)) || 18.4, // $18.4K from UI
          trend: {
            value: previousWeekMetrics?.metrics?.totalLaborCost?.value
              ? calculateTrend(
                  laborCostEstimate / 1000,
                  previousWeekMetrics.metrics.totalLaborCost.value,
                )
              : 14,
            period: 'week',
          },
        },
        totalMaterialUsed: {
          value: materialData.totalMaterialUsed || 2714, // Default from UI
          trend: {
            value: previousMonthMetrics?.metrics?.totalMaterialUsed?.value
              ? calculateTrend(
                  materialData.totalMaterialUsed,
                  previousMonthMetrics.metrics.totalMaterialUsed.value,
                )
              : 11,
            period: 'month',
          },
        },
        materialWasted: {
          value: materialData.materialWasted || 879, // Default from UI
          trend: {
            value: previousMonthMetrics?.metrics?.materialWasted?.value
              ? calculateTrend(
                  materialData.materialWasted,
                  previousMonthMetrics.metrics.materialWasted.value,
                )
              : 14,
            period: 'month',
          },
        },
        materialAvailable: {
          value: materialData.materialAvailable || 693, // Default from UI
          trend: {
            value: previousMonthMetrics?.metrics?.materialAvailable?.value
              ? calculateTrend(
                  materialData.materialAvailable,
                  previousMonthMetrics.metrics.materialAvailable.value,
                )
              : -8,
            period: 'month',
          },
        },
        materialUsed: {
          value: secondaryMaterialUsed || 1142, // Default from UI
          trend: {
            value: previousMonthMetrics?.metrics?.materialUsed?.value
              ? calculateTrend(
                  secondaryMaterialUsed,
                  previousMonthMetrics.metrics.materialUsed.value,
                )
              : 9,
            period: 'month',
          },
        },
        totalLaborHours: {
          value: parseFloat(
            (laborStats.length > 0 ? laborStats[0].totalLaborHours / 1000 : 12.8).toFixed(1),
          ),
          trend: {
            value: previousMonthMetrics?.metrics?.totalLaborHours?.value
              ? calculateTrend(
                  laborStats.length > 0 ? laborStats[0].totalLaborHours / 1000 : 12.8,
                  previousMonthMetrics.metrics.totalLaborHours.value,
                )
              : 17,
            period: 'month',
          },
        },
      };

      // Save new metrics record
      const newMetricsRecord = new DashboardMetrics({
        date: new Date(),
        metrics,
        snapshotType: 'current',
      });

      await newMetricsRecord.save();

      return metrics;
    } catch (error) {
      console.error('Error generating dashboard metrics:', error);
      throw error;
    }
  };

  /**
   * Stores weekly and monthly snapshots for trend calculations
   */
  const storeMetricsSnapshot = async () => {
    try {
      // Check if we already have a snapshot for this week
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // Set to Sunday of current week
      startOfWeek.setHours(0, 0, 0, 0);

      // Check for existing weekly snapshot
      const existingWeeklySnapshot = await DashboardMetrics.findOne({
        date: { $gte: startOfWeek },
        snapshotType: 'weekly',
      });

      // Check if we already have a snapshot for this month
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Check for existing monthly snapshot
      const existingMonthlySnapshot = await DashboardMetrics.findOne({
        date: { $gte: startOfMonth },
        snapshotType: 'monthly',
      });

      // Generate current metrics if we need to create snapshots
      let metrics = null;
      if (!existingWeeklySnapshot || !existingMonthlySnapshot) {
        // Get the most recent metrics
        const latestMetrics = await DashboardMetrics.findOne({
          snapshotType: 'current',
        })
          .sort({ date: -1 })
          .lean();

        if (latestMetrics) {
          metrics = latestMetrics.metrics;
        } else {
          // If no current metrics exist, generate them
          metrics = await generateDashboardMetrics();
        }
      }

      // If we don't have a weekly snapshot for this week, create one
      if (!existingWeeklySnapshot && metrics) {
        const weeklySnapshot = new DashboardMetrics({
          date: today,
          metrics,
          snapshotType: 'weekly',
        });
        await weeklySnapshot.save();
        console.log('Weekly snapshot stored');
      }

      // If we don't have a monthly snapshot for this month, create one
      if (!existingMonthlySnapshot && metrics) {
        const monthlySnapshot = new DashboardMetrics({
          date: today,
          metrics,
          snapshotType: 'monthly',
        });
        await monthlySnapshot.save();
        console.log('Monthly snapshot stored');
      }
    } catch (error) {
      console.error('Error storing metrics snapshot:', error);
    }
  };

  /**
   * Get latest material cost data with trends
   */
  const getMaterialCostTrends = async (req, res) => {
    try {
      // Get all materials and their associated types with costs
      const materialData = await BuildingMaterial.aggregate([
        {
          $lookup: {
            from: 'buildingInventoryTypes',
            localField: 'itemType',
            foreignField: '_id',
            as: 'itemTypeDetails',
          },
        },
        {
          $unwind: '$itemTypeDetails',
        },
        {
          $project: {
            materialTypeId: '$itemType',
            materialName: '$itemTypeDetails.name',
            unit: '$itemTypeDetails.unit',
            stockBought: 1,
            stockUsed: 1,
            stockWasted: 1,
            stockAvailable: 1,
          },
        },
        {
          $group: {
            _id: '$materialTypeId',
            materialName: { $first: '$materialName' },
            unit: { $first: '$unit' },
            totalStockBought: { $sum: '$stockBought' },
            totalStockUsed: { $sum: '$stockUsed' },
            totalStockWasted: { $sum: '$stockWasted' },
            totalStockAvailable: { $sum: '$stockAvailable' },
          },
        },
      ]);

      // For each material, simulate month-over-month changes for prototype purposes
      const materialsWithTrends = materialData.map((material) => {
        // For prototype, generate random values for cost trends
        const trendPercentage = Math.floor(Math.random() * 15) - 5; // Random value between -5% and +10%
        const estimatedCostPerUnit = (25 + Math.random() * 50).toFixed(2);

        return {
          materialTypeId: material._id,
          materialName: material.materialName,
          currentCost: parseFloat(estimatedCostPerUnit),
          unit: material.unit,
          totalStockBought: material.totalStockBought,
          totalStockUsed: material.totalStockUsed,
          totalStockAvailable: material.totalStockAvailable,
          lastUpdated: new Date(),
          monthOverMonthChange: parseFloat(
            ((estimatedCostPerUnit * trendPercentage) / 100).toFixed(2),
          ),
          monthOverMonthPercentage: trendPercentage,
        };
      });

      return res.status(200).json(materialsWithTrends);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  /**
   * Get all dashboard metrics in a single call
   */
  const getAllMetrics = async (req, res) => {
    try {
      // Try to store weekly/monthly snapshots if needed
      await storeMetricsSnapshot();

      // Get the latest dashboard metrics
      const latestMetrics = await DashboardMetrics.findOne({
        snapshotType: 'current',
      })
        .sort({ date: -1 })
        .lean();

      let metrics;
      if (!latestMetrics) {
        // If no metrics found, generate them now
        metrics = await generateDashboardMetrics();
      } else {
        metrics = latestMetrics.metrics;
      }

      // Format response to match UI expectations
      const formattedMetrics = {
        totalProjects: {
          value: metrics.totalProjects.value,
          trend: {
            value: metrics.totalProjects.trend.value,
            direction: metrics.totalProjects.trend.value >= 0 ? 'increase' : 'decrease',
            period: metrics.totalProjects.trend.period,
          },
        },
        completedProjects: {
          value: metrics.completedProjects.value,
          trend: {
            value: metrics.completedProjects.trend.value,
            direction: metrics.completedProjects.trend.value >= 0 ? 'increase' : 'decrease',
            period: metrics.completedProjects.trend.period,
          },
        },
        delayedProjects: {
          value: metrics.delayedProjects.value,
          trend: {
            value: metrics.delayedProjects.trend.value,
            direction: metrics.delayedProjects.trend.value >= 0 ? 'increase' : 'decrease',
            period: metrics.delayedProjects.trend.period,
          },
        },
        activeProjects: {
          value: metrics.activeProjects.value,
          trend: {
            value: metrics.activeProjects.trend.value,
            direction: metrics.activeProjects.trend.value >= 0 ? 'increase' : 'decrease',
            period: metrics.activeProjects.trend.period,
          },
        },
        avgProjectDuration: {
          value: metrics.avgProjectDuration.value,
          unit: 'hrs',
          trend: {
            value: metrics.avgProjectDuration.trend.value,
            direction: metrics.avgProjectDuration.trend.value >= 0 ? 'increase' : 'decrease',
            period: metrics.avgProjectDuration.trend.period,
          },
        },
        totalMaterialCost: {
          value: metrics.totalMaterialCost.value,
          unit: 'K',
          prefix: '$',
          trend: {
            value: metrics.totalMaterialCost.trend.value,
            direction: metrics.totalMaterialCost.trend.value >= 0 ? 'increase' : 'decrease',
            period: metrics.totalMaterialCost.trend.period,
          },
        },
        totalLaborCost: {
          value: metrics.totalLaborCost.value,
          unit: 'K',
          prefix: '$',
          trend: {
            value: metrics.totalLaborCost.trend.value,
            direction: metrics.totalLaborCost.trend.value >= 0 ? 'increase' : 'decrease',
            period: metrics.totalLaborCost.trend.period,
          },
        },
        totalMaterialUsed: {
          value: metrics.totalMaterialUsed.value,
          trend: {
            value: metrics.totalMaterialUsed.trend.value,
            direction: metrics.totalMaterialUsed.trend.value >= 0 ? 'increase' : 'decrease',
            period: metrics.totalMaterialUsed.trend.period,
          },
        },
        materialWasted: {
          value: metrics.materialWasted.value,
          trend: {
            value: metrics.materialWasted.trend.value,
            direction: metrics.materialWasted.trend.value >= 0 ? 'increase' : 'decrease',
            period: metrics.materialWasted.trend.period,
          },
        },
        materialAvailable: {
          value: metrics.materialAvailable.value,
          trend: {
            value: metrics.materialAvailable.trend.value,
            direction: metrics.materialAvailable.trend.value >= 0 ? 'increase' : 'decrease',
            period: metrics.materialAvailable.trend.period,
          },
        },
        materialUsed: {
          value: metrics.materialUsed.value,
          trend: {
            value: metrics.materialUsed.trend.value,
            direction: metrics.materialUsed.trend.value >= 0 ? 'increase' : 'decrease',
            period: metrics.materialUsed.trend.period,
          },
        },
        totalLaborHours: {
          value: metrics.totalLaborHours.value,
          unit: 'K',
          trend: {
            value: metrics.totalLaborHours.trend.value,
            direction: metrics.totalLaborHours.trend.value >= 0 ? 'increase' : 'decrease',
            period: metrics.totalLaborHours.trend.period,
          },
        },
      };

      return res.status(200).json(formattedMetrics);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  /**
   * Get historical metrics for trend analysis
   */
  const getHistoricalMetrics = async (req, res) => {
    try {
      const { startDate, endDate, metric } = req.query;

      // Validate required parameters
      if (!startDate || !endDate || !metric) {
        return res.status(400).json({
          error: 'Missing required parameters: startDate, endDate, and metric are required',
        });
      }

      // Validate that metric exists in schema
      const validMetrics = [
        'totalProjects',
        'completedProjects',
        'delayedProjects',
        'activeProjects',
        'avgProjectDuration',
        'totalMaterialCost',
        'totalLaborCost',
        'totalMaterialUsed',
        'materialWasted',
        'materialAvailable',
        'materialUsed',
        'totalLaborHours',
      ];

      if (!validMetrics.includes(metric)) {
        return res.status(400).json({
          error: `Invalid metric. Valid options are: ${validMetrics.join(', ')}`,
        });
      }

      // Query for metrics within date range - include all snapshot types for a complete timeline
      const metricsHistory = await DashboardMetrics.find({
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      })
        .select(`date metrics.${metric}`)
        .sort({ date: 1 })
        .lean();

      // Format the response data
      const formattedHistory = metricsHistory.map((entry) => ({
        date: entry.date,
        value: entry.metrics[metric].value,
      }));

      return res.status(200).json(formattedHistory);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  /**
   * Force refresh of dashboard metrics
   */
  const refreshMetrics = async (req, res) => {
    try {
      // Generate new metrics
      const newMetrics = await generateDashboardMetrics();

      // Store snapshots if needed
      await storeMetricsSnapshot();

      // Format response
      const formattedMetrics = {
        message: 'Dashboard metrics refreshed successfully',
        timestamp: new Date(),
        metrics: newMetrics,
      };

      return res.status(200).json(formattedMetrics);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };

  return {
    getMaterialCostTrends,
    getAllMetrics,
    getHistoricalMetrics,
    refreshMetrics,
    generateDashboardMetrics,
  };
};

module.exports = bmDashboardPrototypeController;