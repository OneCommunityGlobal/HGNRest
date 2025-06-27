const express = require('express');
const router = express.Router();
const JobPosting = require('../models/JobPosting');

// Utility function to calculate conversion rate
const calcConversionRate = (job) => {
  const rate = job.hits > 0 ? (job.applications / job.hits) * 100 : 0;
  return { ...job._doc, conversionRate: parseFloat(rate.toFixed(2)) };
};

// Helper function to parse and adjust date range
function getDateRange(startDate, endDate) {
  if (!startDate || !endDate) {
    throw new Error('startDate and endDate are required');
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999); // include entire end day
  return { start, end };
}

// GET: All analytics
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { start, end } = getDateRange(startDate, endDate);

    const query = { datePosted: { $gte: start, $lte: end } };
    console.log('MongoDB query:', query);

    const jobs = await JobPosting.find(query);
    res.json(jobs.map(calcConversionRate));
  } catch (error) {
    console.error('Error in GET /:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// GET: Top converted jobs
router.get('/top-converted', async (req, res) => {
  try {
    const { limit = 10, startDate, endDate } = req.query;
    const { start, end } = getDateRange(startDate, endDate);

    const query = { datePosted: { $gte: start, $lte: end } };
    console.log('MongoDB query:', query);

    const jobs = await JobPosting.find(query);
    const sorted = jobs
      .map(calcConversionRate)
      .sort((a, b) => b.conversionRate - a.conversionRate)
      .slice(0, parseInt(limit, 10));

    res.json(sorted);
  } catch (error) {
    console.error('Error in GET /top-converted:', error.message);
    res.status(400).json({ error: error.message });
  }
});

router.get('/least-converted', async (req, res) => {
  try {
    const { limit = 10, startDate, endDate } = req.query;
    const { start, end } = getDateRange(startDate, endDate);

    const jobs = await JobPosting.find({
      datePosted: { $gte: start, $lte: end },
    });

    console.log('Jobs fetched:', jobs.length);

    const jobsWithConversion = jobs.map(calcConversionRate);
    console.log('Jobs with conversion rates:', jobsWithConversion);

    const sorted = jobsWithConversion
      .sort((a, b) => a.conversionRate - b.conversionRate)
      .slice(0, parseInt(limit, 10));

    console.log('Sorted least converted:', sorted);

    res.json(sorted);
  } catch (error) {
    console.error('Error in GET /least-converted:', error.message);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
