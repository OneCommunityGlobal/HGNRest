const mongoose = require('mongoose');
const Labour = require('../models/laborCost');

const createLabourCost = async (req, res) => {
  const labourCost = req.body;

  if (!labourCost.project_name || !labourCost.task || !labourCost.cost || !labourCost.date) {
    return res.status(400).json({ success: false, message: 'Please provide all fields' });
  }
  if (Number.isNaN(Number(labourCost.cost)) || labourCost.cost <= 0) {
    return res.status(400).json({ success: false, message: 'Cost Cannot be less than or 0!' });
  }

  const newLabourCost = new Labour(labourCost);

  try {
    await newLabourCost.save();
    res
      .status(201)
      .json({ success: true, data: newLabourCost, message: 'Labor cost entry added successfully' });
  } catch (error) {
    console.error('Error in Adding Labour Cost:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const getLabourCost = async (req, res) => {
  try {
    const labourCost = await Labour.find({});
    res.status(200).json({ success: true, data: labourCost });
  } catch (error) {
    console.log('error in fetching labour costs:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const getLabourCostByDate = async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    res.status(500).json({ success: false, message: 'Both startdate and enddate are required' });
  }
  try {
    const filteredData = await Labour.find({
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    });
    res.status(200).json({ success: true, data: filteredData });
  } catch (error) {
    console.log('error in fetching labour costs by date:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const getLabourCostByProject = async (req, res) => {
  const { project_name } = req.query;

  if (!project_name) {
    res.status(500).json({ success: false, message: 'Project Name not provided' });
  }

  try {
    const filteredDatabyProject = await Labour.find({
      project_name: { $regex: project_name, $options: 'i' },
    });
    res.status(200).json({ success: true, data: filteredDatabyProject });
  } catch (error) {
    console.log('error in fetching data by project name:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const getLabourCostByTask = async (req, res) => {
  const { task } = req.query;

  if (!task) {
    res.status(500).json({ success: false, message: 'Task Name not provided' });
  }

  try {
    const filteredDatabyTask = await Labour.find({
      task: { $regex: task, $options: 'i' },
    });
    res.status(200).json({ success: true, data: filteredDatabyTask });
  } catch (error) {
    console.log('error in fetching data by project name:', error.message);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = {
  createLabourCost,
  getLabourCost,
  getLabourCostByDate,
  getLabourCostByProject,
  getLabourCostByTask,
};
