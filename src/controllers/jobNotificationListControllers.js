const mongoose = require('mongoose');
const jobs = require('../models/jobs');
const JobsNotificationList = require('../models/jobsNotificationList');

const { ObjectId } = mongoose.Types;

const isOwner = async (req, res, next) => {
  const { requestor } = req.body; // Correctly access the requestor

  try {
    if (!requestor || requestor.role.toLowerCase() !== 'owner') {
      return res.status(403).json({ error: 'Access denied' }); // Check ownership
    }
    next(); // Proceed if the user is an owner
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' }); // Handle unexpected errors
  }
};

const getJobWatchList = async (req, res) => {
  const { jobId, category, title } = req.query;

  try {
    const match = {};
    if (jobId) match._id = ObjectId(jobId); // Convert jobId to ObjectId
    if (category) match.category = category; // Match by category
    if (title) match.title = new RegExp(title, 'i'); // Search by job title (case-insensitive)

    const jobsWithCC = await jobs.aggregate([
      { $match: match }, // Apply filters
      {
        $lookup: {
          from: 'jobsnotificationlists', // Match CC list collection
          localField: '_id',
          foreignField: 'jobId',
          as: 'ccList', // Name for the joined data
        },
      },
      {
        $project: {
          _id: 1, // Ensure the job's _id is included
          title: 1,
          category: 1,
          datePosted: 1,
          'ccList._id': 1, // Include the _id of each CC entry
          'ccList.email': 1, // Only include emails from the CC list
        },
      },
      { $sort: { datePosted: -1 } }, // Sort by most recent jobs
    ]);

    res.status(200).json(jobsWithCC);
  } catch (err) {
    console.error(err); // Log error for debugging
    res.status(500).json({ error: 'Internal server error' });
  }
};

const addCCByJob = async (req, res) => {
  const { email, jobId } = req.body;

  if (!email || !jobId) {
    return res.status(400).json({ error: 'Email, Job ID, and Category are required' });
  }

  try {
    let job;
    if (jobId) {
      job = await jobs.findById(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
    }

    const ccEntry = new JobsNotificationList({
      email,
      jobId: jobId || null,
      category: job.category || null,
    });

    await ccEntry.save();

    res.status(201).json({ message: 'Email added to CC list successfully' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Email already exists in the CC list' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

const addCCByCategory = async (req, res) => {
  const { email, category } = req.body;

  // Validate input
  if (!email || !category) {
    return res.status(400).json({ error: 'Email and Category are required' });
  }

  try {
    // Check if the category exists
    const categoryExists = await jobs.exists({ category });
    if (!categoryExists) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Find all jobs in the specified category
    const jobArr = await jobs.find({ category });

    if (jobArr.length === 0) {
      return res.status(404).json({ error: 'No jobs found in this category' });
    }

    // Create bulk operations for all jobs in the category
    const bulkOps = jobArr.map((job) => ({
      updateOne: {
        filter: { email, jobId: job._id, category: job.category },
        update: { $setOnInsert: { email, jobId: job._id, category: job.category } },
        upsert: true, // Perform upsert to avoid duplicates
      },
    }));

    // Execute bulkWrite operation
    const result = await JobsNotificationList.bulkWrite(bulkOps);

    res.status(201).json({
      message: 'Email added to CC list successfully',
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const removeEmailFromCCList = async (req, res) => {
  const { id } = req.params; // ID of the CC entry

  try {
    const result = await JobsNotificationList.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).json({ error: 'CC entry not found' });
    }
    res.status(200).json({ message: 'CC entry removed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  isOwner,
  getJobWatchList,
  addCCByJob,
  addCCByCategory,
  removeEmailFromCCList,
};
