const WastedMaterial = require('../models/mostWastedModel');

// new controller
export const createWastedMaterial = async (req, res) => {
  const wastedtMaterialbody = req.body;

  if (
    !wastedtMaterialbody.projectId ||
    !wastedtMaterialbody.projectName ||
    !wastedtMaterialbody.material ||
    !wastedtMaterialbody.wastagePercentage ||
    !wastedtMaterialbody.date
  ) {
    return res.status(400).json({ success: false, message: 'Please provide all fields' });
  }
  if (
    Number.isNaN(Number(wastedtMaterialbody.wastagePercentage)) ||
    wastedtMaterialbody.wastagePercentage <= 0
  ) {
    return res
      .status(400)
      .json({ success: false, message: 'Waste percentage cannot be less than or 0!' });
  }

  const newWastedMaterial = new WastedMaterial(wastedtMaterialbody);

  try {
    await newWastedMaterial.save();
    res.status(201).json({
      success: true,
      data: newWastedMaterial,
      message: 'Wasted Material entry added successfully',
    });
  } catch (error) {
    console.error('Error in Adding Wasted Material:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const getWastedMaterial = async (req, res) => {
  try {
    const wastedMaterialRes = await WastedMaterial.find({});
    res.status(200).json({ success: true, data: wastedMaterialRes });
  } catch (error) {
    console.log('error in fetching Wasted Material:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const getWastedMaterialByDate = async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    res.status(500).json({ success: false, message: 'Both startdate and enddate are required' });
  }
  try {
    const filteredData = await WastedMaterial.find({
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    });
    res.status(200).json({ success: true, data: filteredData });
  } catch (error) {
    console.log('error in fetching Wasted Material by date:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const getWastedMaterialByProject = async (req, res) => {
  const { projectIdBody } = req.query;

  if (!projectIdBody) {
    res.status(500).json({ success: false, message: 'Project Name not provided' });
  }

  try {
    const filteredDatabyProject = await WastedMaterial.find({
      projectId: { $regex: projectIdBody, $options: 'i' },
    });
    res.status(200).json({ success: true, data: filteredDatabyProject });
  } catch (error) {
    console.log('error in fetching data by project name:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
