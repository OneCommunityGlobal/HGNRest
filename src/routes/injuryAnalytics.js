const express = require('express');

const router = express.Router();
const mongoose = require('mongoose');
const { parseISO, endOfDay, isAfter, differenceInDays } = require('date-fns');
const Injury = require('../models/injury');

// Maximum allowed date range (in days)
const MAX_DATE_RANGE = 365;

// GET /api/injuries/distribution
router.get('/injuries/distribution', async (req, res) => {
  try {
    const { projectId = 'all', startDate, endDate, groupBy = 'severity' } = req.query;

    const query = {};

    // -----------------------------
    // Project ID filter
    // -----------------------------
    if (projectId !== 'all') {
      try {
        query.projectId = mongoose.Types.ObjectId(projectId);
      } catch (err) {
        return res.status(400).json({ error: 'Invalid projectId' });
      }
    }

    // -----------------------------
    // Date range filter
    // -----------------------------
    let start;
    let end;
    if (startDate) start = parseISO(startDate);
    if (endDate) end = endOfDay(parseISO(endDate));

    // Swap if start > end
    if (start && end && isAfter(start, end)) [start, end] = [end, start];

    // Cap range to MAX_DATE_RANGE
    if (start && end && differenceInDays(end, start) > MAX_DATE_RANGE) {
      end = endOfDay(new Date(start.getTime() + MAX_DATE_RANGE * 24 * 60 * 60 * 1000));
    }

    if (start || end) {
      query.date = {};
      if (start) query.date.$gte = start;
      if (end) query.date.$lte = end;
    }

    // -----------------------------
    // Determine group field
    // -----------------------------
    const groupField = groupBy === 'injuryType' ? '$injuryType' : '$severity';

    // -----------------------------
    // Aggregation pipeline
    // -----------------------------
    const results = await Injury.aggregate([
      { $match: query },
      { $group: { _id: groupField, count: { $sum: 1 } } },
    ]);

    const total = results.reduce((sum, r) => sum + r.count, 0);

    // Format results with percentages
    const formatted = results.map((r) => ({
      category: r._id,
      count: r.count,
      percent: total > 0 ? ((r.count / total) * 100).toFixed(1) : '0.0',
    }));

    // -----------------------------
    // Stable sorting
    // -----------------------------
    if (groupBy === 'severity') {
      const severityOrder = ['Minor', 'Moderate', 'Severe', 'Critical'];
      formatted.sort(
        (a, b) => severityOrder.indexOf(a.category) - severityOrder.indexOf(b.category),
      );
    } else {
      // injuryType: sort descending by count
      formatted.sort((a, b) => b.count - a.count);
    }

    // -----------------------------
    // Response
    // -----------------------------
    res.json({
      total,
      distribution: formatted,
    });
  } catch (error) {
    console.error('Error fetching injury distribution:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
