const mongoose = require('mongoose');

const plannedCostController = (PlannedCost, Project) => {
  const getPlannedCostBreakdown = async (req, res) => {
    console.log('[Controller] GET /planned-cost-breakdown hit, projectId:', req.params.projectId);

    try {
      const { projectId } = req.params;
      console.log('[Controller] Requested projectId:', projectId, 'Type:', typeof projectId);

      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).send({ error: 'Invalid project ID' });
      }

      const project = await Project.findById(projectId);
      if (!project) return res.status(404).send({ error: 'Project not found' });
      console.log('[Controller] Found project:', project.projectName);

      console.log('[Controller] Querying PlannedCost with projectId:', projectId);
      console.log('[Controller] PlannedCost model collection name:', PlannedCost.collection.name);

      // Try to find planned costs with both ObjectId and string versions of projectId
      let plannedCosts = await PlannedCost.find({ projectId });
      console.log('[Controller] Found planned costs with ObjectId query:', plannedCosts);

      // If no results, try with string version
      if (plannedCosts.length === 0) {
        console.log('[Controller] No results with ObjectId, trying string query...');
        plannedCosts = await PlannedCost.find({ projectId: projectId.toString() });
        console.log('[Controller] Found planned costs with string query:', plannedCosts);
      }

      // If still no results, try with both ObjectId and string in the same query
      if (plannedCosts.length === 0) {
        console.log('[Controller] No results with string, trying OR query...');
        plannedCosts = await PlannedCost.find({
          $or: [{ projectId }, { projectId: projectId.toString() }],
        });
        console.log('[Controller] Found planned costs with OR query:', plannedCosts);
      }

      // If still no results, try a more direct approach
      if (plannedCosts.length === 0) {
        console.log('[Controller] No results with any query, trying direct collection access...');
        const { db } = PlannedCost;
        const collection = db.collection('plannedCosts');
        plannedCosts = await collection.find({ projectId: projectId.toString() }).toArray();
        console.log('[Controller] Found planned costs with direct collection query:', plannedCosts);
      }

      const total = plannedCosts.reduce((sum, c) => sum + c.plannedCost, 0);
      console.log('[Controller] Total calculated:', total);

      const breakdown = {};
      plannedCosts.forEach((c) => {
        console.log('[Controller] Processing category:', c.category, 'cost:', c.plannedCost);
        console.log(
          '[Controller] Category type:',
          typeof c.category,
          'Cost type:',
          typeof c.plannedCost,
        );

        // Sum up costs for the same category instead of overwriting
        if (breakdown[c.category]) {
          breakdown[c.category] += c.plannedCost;
          console.log(
            '[Controller] Added to existing category. New total for',
            c.category,
            ':',
            breakdown[c.category],
          );
        } else {
          breakdown[c.category] = c.plannedCost;
          console.log('[Controller] New category added:', c.category, '=', c.plannedCost);
        }
      });
      console.log('[Controller] Final breakdown:', breakdown);

      // Also try to query with different approaches to debug
      console.log('[Controller] Trying alternative query...');
      const allPlannedCosts = await PlannedCost.find({});
      console.log('[Controller] All planned costs in DB:', allPlannedCosts.length);
      if (allPlannedCosts.length > 0) {
        console.log(
          '[Controller] Sample planned cost document:',
          JSON.stringify(allPlannedCosts[0], null, 2),
        );
      }

      res.status(200).send({ projectId, projectName: project.projectName, total, breakdown });
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Internal server error' });
    }
  };

  const getAllPlannedCostsForProject = async (req, res) => {
    console.log('[Controller] GET /planned-costs hit, projectId:', req.params.projectId);

    try {
      const { projectId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).send({ error: 'Invalid project ID' });
      }

      const project = await Project.findById(projectId);
      if (!project) return res.status(404).send({ error: 'Project not found' });

      // Try to find planned costs with both ObjectId and string versions of projectId
      let plannedCosts = await PlannedCost.find({ projectId });
      if (plannedCosts.length === 0) {
        plannedCosts = await PlannedCost.find({ projectId: projectId.toString() });
      }
      if (plannedCosts.length === 0) {
        plannedCosts = await PlannedCost.find({
          $or: [{ projectId }, { projectId: projectId.toString() }],
        });
      }

      // Group by category and sum up costs
      const groupedCosts = {};
      plannedCosts.forEach((cost) => {
        if (groupedCosts[cost.category]) {
          groupedCosts[cost.category] += cost.plannedCost;
        } else {
          groupedCosts[cost.category] = cost.plannedCost;
        }
      });

      res.status(200).send({
        projectId,
        projectName: project.projectName,
        plannedCosts,
        groupedCosts,
      });
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Internal server error' });
    }
  };

  const createOrUpdatePlannedCost = async (req, res) => {
    console.log('[Controller] POST /planned-costs hit, projectId:', req.params.projectId);

    try {
      const { projectId } = req.params;
      const { category, plannedCost } = req.body;

      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).send({ error: 'Invalid project ID' });
      }

      if (!category || !plannedCost) {
        return res.status(400).send({ error: 'Category and plannedCost are required' });
      }

      const validCategories = ['Plumbing', 'Electrical', 'Structural', 'Mechanical'];
      if (!validCategories.includes(category)) {
        return res.status(400).send({ error: 'Invalid category' });
      }

      const project = await Project.findById(projectId);
      if (!project) return res.status(404).send({ error: 'Project not found' });

      const result = await PlannedCost.findOneAndUpdate(
        { projectId, category },
        { plannedCost },
        { upsert: true, new: true },
      );

      res.status(200).send({ message: 'Planned cost updated successfully', data: result });
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Internal server error' });
    }
  };

  const deletePlannedCost = async (req, res) => {
    console.log(
      '[Controller] DELETE /planned-costs hit, projectId:',
      req.params.projectId,
      'category:',
      req.params.category,
    );

    try {
      const { projectId, category } = req.params;

      if (!mongoose.Types.ObjectId.isValid(projectId)) {
        return res.status(400).send({ error: 'Invalid project ID' });
      }

      const validCategories = ['Plumbing', 'Electrical', 'Structural', 'Mechanical'];
      if (!validCategories.includes(category)) {
        return res.status(400).send({ error: 'Invalid category' });
      }

      const result = await PlannedCost.findOneAndDelete({ projectId, category });
      if (!result) {
        return res.status(404).send({ error: 'Planned cost not found' });
      }

      res.status(200).send({ message: 'Planned cost deleted successfully', data: result });
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Internal server error' });
    }
  };

  return {
    getPlannedCostBreakdown,
    getAllPlannedCostsForProject,
    createOrUpdatePlannedCost,
    deletePlannedCost,
  };
};

module.exports = plannedCostController;
