const Job = require('../models/jobs');
const JobPositionCategory = require('../models/jobPositionCategory');

/* ============================================================
   UTILS
   ============================================================ */

const escapeRegex = (text = '') => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseCategory = (category) => {
  if (!category) return [];

  if (Array.isArray(category)) return category;

  try {
    const parsed = JSON.parse(category);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return category
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
  }
};

const buildConditions = ({ search, category, position }) => {
  const conditions = [];

  /* SEARCH */
  if (search?.trim()) {
    const safe = escapeRegex(search.trim());
    conditions.push({
      $or: [
        { title: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
      ],
    });
  }

  /* POSITION */
  if (position?.trim()) {
    const safe = escapeRegex(position.trim());
    conditions.push({
      title: { $regex: safe, $options: 'i' },
    });
  }

  /* CATEGORY */
  const categoryList = parseCategory(category);
  if (categoryList.length > 0) {
    conditions.push({ category: { $in: categoryList } });
  }

  return conditions.length ? { $and: conditions } : {};
};

/* ============================================================
   PAGINATION CONTROLLER
   ============================================================ */

const paginationForJobs = async (req, res) => {
  const { page = 1, limit = 18, search = '', category = '', position = '' } = req.query;

  try {
    const pageNumber = Math.max(1, parseInt(page, 10));
    const limitNumber = Math.max(1, parseInt(limit, 10));

    const query = buildConditions({ search, category, position });

    const totalJobs = await Job.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(totalJobs / limitNumber));

    const pageNum = Math.min(pageNumber, totalPages);

    const jobs = await Job.find(query)
      .sort({ displayOrder: 1, featured: -1, datePosted: -1, title: 1 })
      .skip((pageNum - 1) * limitNumber)
      .limit(limitNumber)
      .lean();

    res.json({
      success: true,
      jobs,
      pagination: {
        totalJobs,
        totalPages,
        currentPage: pageNum,
        limit: limitNumber,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch jobs',
      details: error.message,
    });
  }
};

const getJobs = (req, res) => paginationForJobs(req, res);

/* ============================================================
   JOB SUMMARIES
   ============================================================ */

const getJobSummaries = async (req, res) => {
  const { search = '', category = '', position = '' } = req.query;

  try {
    const query = buildConditions({ search, category, position });

    const jobs = await Job.find(query)
      .select('title category location description datePosted featured jobDetailsLink')
      .sort({ displayOrder: 1, featured: -1, datePosted: -1, title: 1 })
      .lean();

    const totalJobs = jobs.length;

    res.json({
      success: true,
      jobs,
      totalJobs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job summaries',
      details: error.message,
    });
  }
};

/* ============================================================
   OTHER CONTROLLERS
   ============================================================ */

const getJobTitleSuggestions = async (req, res) => {
  const { query = '' } = req.query;

  try {
    const suggestions = await Job.find({
      title: { $regex: query, $options: 'i' },
    }).distinct('title');

    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job title suggestions' });
  }
};

const resetJobsFilters = async (req, res) => {
  const { page = 1, limit = 18 } = req.query;

  try {
    const pageNumber = Math.max(1, parseInt(page, 10));
    const limitNumber = Math.max(1, parseInt(limit, 10));

    const totalJobs = await Job.countDocuments({});
    const totalPages = Math.ceil(totalJobs / limitNumber);

    const jobs = await Job.find({})
      .sort({ displayOrder: 1, featured: -1, datePosted: -1, title: 1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    res.json({
      jobs,
      pagination: {
        totalJobs,
        totalPages,
        currentPage: pageNumber,
        limit: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPreviousPage: pageNumber > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to reset filters',
      details: error.message,
    });
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await JobPositionCategory.distinct('category', {});
    categories.sort((a, b) => a.localeCompare(b));
    res.status(200).json({ categories });
  } catch {
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
};

const getPositions = async (req, res) => {
  try {
    const positions = await JobPositionCategory.distinct('position', {});
    positions.sort((a, b) => a.localeCompare(b));
    res.status(200).json({ positions });
  } catch {
    res.status(500).json({ message: 'Failed to fetch positions' });
  }
};

const getJobById = async (req, res) => {
  const { id } = req.params;

  try {
    const job = await Job.findById(id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    res.json(job);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch job',
      details: error.message,
    });
  }
};

const createJob = async (req, res) => {
  const { title, category, description, imageUrl, location, applyLink, jobDetailsLink } = req.body;

  try {
    const highestOrderJob = await Job.findOne().sort({ displayOrder: -1 });
    const newDisplayOrder = highestOrderJob ? highestOrderJob.displayOrder + 1 : 0;

    const newJob = new Job({
      title,
      category,
      description,
      imageUrl,
      location,
      applyLink,
      jobDetailsLink,
      displayOrder: newDisplayOrder,
    });

    const savedJob = await newJob.save();
    res.status(201).json(savedJob);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create job',
      details: error.message,
    });
  }
};

const updateJob = async (req, res) => {
  const { id } = req.params;

  try {
    const updatedJob = await Job.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedJob) return res.status(404).json({ error: 'Job not found' });

    res.json(updatedJob);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update job',
      details: error.message,
    });
  }
};

const deleteJob = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedJob = await Job.findByIdAndDelete(id);
    if (!deletedJob) return res.status(404).json({ error: 'Job not found' });

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete job',
      details: error.message,
    });
  }
};

const reorderJobs = async (req, res) => {
  const { jobIds } = req.body;

  try {
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return res.status(400).json({ error: 'Invalid job order data' });
    }

    const updateOperations = jobIds.map((jobId, index) => ({
      updateOne: {
        filter: { _id: jobId },
        update: { $set: { displayOrder: index } },
      },
    }));

    await Job.bulkWrite(updateOperations);

    const jobs = await Job.find({ _id: { $in: jobIds } }).sort({ displayOrder: 1 });

    res.json({
      success: true,
      message: 'Jobs reordered successfully',
      jobs,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to reorder jobs',
      details: error.message,
    });
  }
};

/* ============================================================
   EXPORTS
   ============================================================ */

module.exports = {
  getJobs,
  getJobTitleSuggestions,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  getJobSummaries,
  resetJobsFilters,
  getCategories,
  reorderJobs,
  getPositions,
};
