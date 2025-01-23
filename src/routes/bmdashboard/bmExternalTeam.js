const express = require('express');
const router = express.Router();

router.post('/externalTeam', async (req, res) => {
  try {
    const teamMember = req.body;
    // Add your database logic here

    res.status(201).json({
      success: true,
      data: teamMember
    });
  } catch (error) {
    console.error('Error creating team member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create external team member'
    });
  }
});

module.exports = router;