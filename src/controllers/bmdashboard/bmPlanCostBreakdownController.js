// src/controllers/bmdashboards/bmPlanCostBreakdownController.js
const mongoose = require('mongoose');
const Cost = require('../../models/bmdashboard/bmPlanCostBreakdown');

exports.getPlannedCostBreakdown = async (req, res) => {
    const { id} = req.params;
    console.log(id);
    try {
        const costs = await Cost.aggregate([
          {
            $match: {
              projectId: new mongoose.Types.ObjectId(id)
            }
          },
          {
            $group: {
              _id: '$category',
              total: { $sum: '$plannedCost' }
            }
          }
        ]);
  
      const breakdown = {
        plumbing: 0,
        electrical: 0,
        structural: 0,
        mechanical: 0,
      };
  
      costs.forEach(({ _id, total }) => {
        const key = _id.toLowerCase();
        if (Object.prototype.hasOwnProperty.call(breakdown, key)) {
          breakdown[key] = total;
        }
      });
  
      res.json(breakdown);
    } catch (err) {
      console.error('Error fetching planned cost breakdown:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  
