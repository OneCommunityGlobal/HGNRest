const express = require('express');
const router = express.Router();
const Applicant = require('../models/jobApplicants');

router.get('/experience-breakdown', async (req, res) => {
  try {
    const { startDate, endDate, roles } = req.query;

    // Build match filter
    let match = {};

    if (startDate || endDate) {
      match.startDate = {};
      if (startDate) match.startDate.$gte = new Date(startDate);
      if (endDate) match.startDate.$lte = new Date(endDate);
    }

    if (roles) {
      const roleArray = Array.isArray(roles) ? roles : roles.split(',');
      match.roles = { $in: roleArray };
    }

    const result = await Applicant.aggregate([
      { $match: match },
      {
        $bucket: {
          groupBy: '$experience',
          boundaries: [0, 1, 3, 5, 100],
          default: 'Unknown',
          output: {
            count: { $sum: 1 },
          },
          labels: ['0-1 years', '1-3 years', '3-5 years', '5+ years'],
        },
      },
    ]);

    if (!result.length) {
      return res.status(404).json({ message: 'No data found for the given filters.' });
    }

    res.json(result);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
router.get('/test', (req, res) => {
  res.send('Test route working!');
});

module.exports = router;
