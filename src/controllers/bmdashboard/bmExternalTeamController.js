const mongoose = require('mongoose');
const ExternalTeam = require('../../models/bmdashboard/buildingExternalTeam');

const createExternalTeam = async (req, res) => {
  try {
    const teamMember = new ExternalTeam(req.body);
    const savedTeamMember = await teamMember.save();

    res.status(201).json({
      success: true,
      data: savedTeamMember,
    });
  } catch (error) {
    console.error('Error creating team member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create external team member',
    });
  }
};

module.exports = {
  createExternalTeam,
};
