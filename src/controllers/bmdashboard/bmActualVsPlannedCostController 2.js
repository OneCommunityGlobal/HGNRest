const BuildingProject = require('../../models/bmdashboard/buildingProject');

const getExpensesByProject = async (req, res) => {
  const { projectId } = req.params;

  try {
    // Fetch project data directly from the database
    const project = await BuildingProject.findById(projectId).lean();

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Extract members and hours worked
    const members = project.members || [];
    const hoursWorked = members.reduce((sum, member) => sum + member.hours, 0);
    const numMembers = members.length;

    // Placeholder for equipment and material data (randomized for cases where data is zero)
    const unitMaterialCost = 10; // Assume each unit costs $10
    const unitRentalRate = 50; // Assume $50 per day rental rate

    // Calculate material cost (sum of all materials' quantity * unit cost)
    const totalMaterialsCost =
      project.materials?.reduce((acc, mat) => {
        const quantity = mat.stockBought || Math.floor(Math.random() * 50) + 1;
        return acc + quantity * unitMaterialCost;
      }, 0) || Math.floor(Math.random() * 1000) + 500;

    // Calculate equipment cost (rental rate * number of days rented)
    const totalEquipmentCost =
      project.materials?.reduce((acc, mat) => {
        const rentalDays =
          mat.purchaseRecord?.reduce((total, record) => {
            if (record.estUsageTime) {
              const days =
                parseInt(record.estUsageTime.split(' ')[0], 10) ||
                Math.floor(Math.random() * 30) + 1;
              return total + days;
            }
            return total;
          }, 0) || Math.floor(Math.random() * 30) + 1;
        return acc + rentalDays * unitRentalRate;
      }, 0) || Math.floor(Math.random() * 2000) + 1000;

    // Calculate labor cost
    const baseRate = 20;
    const adjustmentFactor = Math.max(0.5, 1 - 0.01 * numMembers);
    const laborCost = baseRate * hoursWorked * numMembers * adjustmentFactor;

    // Calculate total actual cost
    const totalActualCost = totalMaterialsCost + totalEquipmentCost + laborCost;

    // Predict the planned cost with adjusted coefficients
    const coefMaterials = 0.8; // Reduced coefficient for materials
    const coefEquipment = 0.7; // Reduced coefficient for equipment
    const coefMembers = 0.4; // Reduced coefficient for members
    const coefHours = 0.6; // Reduced coefficient for hours
    const intercept = 1000; // Reduced baseline cost

    const predictedCost =
      intercept +
      coefMaterials * totalMaterialsCost +
      coefEquipment * totalEquipmentCost +
      coefMembers * numMembers +
      coefHours * hoursWorked;

    // Ensure planned cost is not greater than actual cost
    const totalPlannedCost = Math.min(predictedCost, totalActualCost);

    // Prepare the response
    const responsePayload = {
      projectId,
      projectName: project.name,
      totalActualCost,
      totalPlannedCost,
      breakdown: [
        { category: 'Labor', actualCost: laborCost, plannedCost: totalPlannedCost * 0.4 },
        {
          category: 'Equipment',
          actualCost: totalEquipmentCost,
          plannedCost: totalPlannedCost * 0.3,
        },
        {
          category: 'Materials',
          actualCost: totalMaterialsCost,
          plannedCost: totalPlannedCost * 0.3,
        },
      ],
    };

    res.json(responsePayload);
  } catch (error) {
    console.error('Error fetching project expenses:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = { getExpensesByProject };
