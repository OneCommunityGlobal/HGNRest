const express = require('express');

const router = express.Router();
const mongoose = require('mongoose');
const { parseISO, endOfDay, isAfter, differenceInDays } = require('date-fns');
const InjurySeverity = require('../models/injury');

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

    if (start && end && isAfter(start, end)) [start, end] = [end, start];
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
    // Aggregation
    // -----------------------------
    const results = await InjurySeverity.aggregate([
      { $match: query },
      { $group: { _id: groupField, count: { $sum: '$count' } } }, //  sum by "count"
    ]);

    const total = results.reduce((sum, r) => sum + r.count, 0);

    const formatted = results.map((r) => ({
      category: r._id || 'Unknown',
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
      formatted.sort((a, b) => b.count - a.count);
    }

    res.json({
      total,
      distribution: formatted,
    });
  } catch (error) {
    console.error('Error fetching injurySeverity distribution:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/projects - returns unique project IDs and names from the Injuries collection
router.get('/injuries/projects', async (req, res) => {
  try {
    const projects = await InjurySeverity.aggregate([
      {
        $group: {
          _id: '$projectId',
          name: { $first: '$projectName' },
        },
      },
      { $match: { _id: { $ne: null } } }, // avoid null ids
    ]);

    const formatted = projects.map((p) => ({
      value: p._id.toString(),
      label: p.name || 'Unnamed Project',
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching projects from injuries:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

module.exports = router;
