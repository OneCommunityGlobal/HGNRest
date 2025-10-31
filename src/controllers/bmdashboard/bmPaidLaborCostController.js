const laborCostController = () => {
  const getLaborCost = async (req, res) => {
    res.status(200).json([]); // Return empty array for now
  };

  return {
    getLaborCost,
  };
};

module.exports = laborCostController;
