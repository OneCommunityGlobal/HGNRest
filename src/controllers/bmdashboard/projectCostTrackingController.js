const projectCostTrackingController = function (ProjectCostTracking) {
  const getProjectCosts = async (req, res) => {
    // TODO: Implement cost retrieval with predictions
    // Query Parameters: categories, fromDate, toDate
    // Returns: { plannedBudget, actual, predicted }
    try {
      res.status(200).json({ message: 'getProjectCosts - Not implemented yet' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  return {
    getProjectCosts,
  };
};

module.exports = projectCostTrackingController;
