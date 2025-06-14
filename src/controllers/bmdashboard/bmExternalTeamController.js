const mongoose = require('mongoose');
const ExternalTeam = require('../../models/bmdashboard/buildingExternalTeam');

const createExternalTeam = async (req, res) => {
  try {
    // Check for required fields
    const requiredFields = ['firstName', 'lastName', 'role', 'team', 'email'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(req.body.email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

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
