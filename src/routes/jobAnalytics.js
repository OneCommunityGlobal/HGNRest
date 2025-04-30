const express = require('express');

const router = express.Router();
const JobPosting = require('../models/JobPosting');

// Utility function
const calcConversionRate = (job) => {
  const rate = job.hits > 0 ? (job.applications / job.hits) * 100 : 0;
  return { ...job._doc, conversionRate: parseFloat(rate.toFixed(2)) };
};

// GET: All analytics
router.get('/', async (req, res) => {
  const { startDate, endDate } = req.query;
  const jobs = await JobPosting.find({
    datePosted: { $gte: new Date(startDate), $lte: new Date(endDate) },
  });

  res.json(jobs.map(calcConversionRate));
});

// GET: Top converted
router.get('/top-converted', async (req, res) => {
  const { limit = 10, startDate, endDate } = req.query;
  const jobs = await JobPosting.find({
    datePosted: { $gte: new Date(startDate), $lte: new Date(endDate) },
  });

  const sorted = jobs
    .map(calcConversionRate)
    .sort((a, b) => b.conversionRate - a.conversionRate)
    .slice(0, parseInt(limit, 10));

  res.json(sorted);
});

// GET: Least converted
router.get('/least-converted', async (req, res) => {
  const { limit = 10, startDate, endDate } = req.query;
  const jobs = await JobPosting.find({
    datePosted: { $gte: new Date(startDate), $lte: new Date(endDate) },
  });

  const sorted = jobs
    .map(calcConversionRate)
    .sort((a, b) => a.conversionRate - b.conversionRate)
    .slice(0, parseInt(limit, 10));

  res.json(sorted);
});

module.exports = router;
