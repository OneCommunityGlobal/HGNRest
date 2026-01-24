const Job = require('../models/jobs');
const JobPositionCategory = require('../models/jobPositionCategory');

/* ============================================================
   INTERNAL: MAIN PAGINATION + FILTERING LOGIC
   ============================================================ */
const paginationForJobs = async (req, res) => {
  const { page = 1, limit = 18, search = '', category = '', position = '' } = req.query;

  try {
    const pageNumber = Math.max(1, parseInt(page, 10));
    const limitNumber = Math.max(1, parseInt(limit, 10));

    const conditions = [];

    /* ----------------------------
       SEARCH FILTER
       ---------------------------- */
    if (search && search.trim() !== '') {
      const searchString = search.trim();
      conditions.push({
        $or: [
          { title: { $regex: new RegExp(searchString, 'i') } },
          { description: { $regex: new RegExp(searchString, 'i') } },
        ],
      });
    }

    /* ----------------------------
       POSITION FILTER (only if non-empty)
       ---------------------------- */
    if (position && position.trim() !== '') {
      conditions.push({ title: { $in: [position.trim()] } });
    }

    /* ----------------------------
       MULTI-CATEGORY FILTER (only if non-empty)
       ---------------------------- */
    if (category && category.trim() !== '') {
      const categoryList = category.split(',').map((c) => c.trim());
      conditions.push({ category: { $in: categoryList } });
    }

    const query = conditions.length ? { $and: conditions } : {};

    const totalJobs = await Job.countDocuments(query);
    const totalPages = Math.ceil(totalJobs / limitNumber);

    const pageNum = pageNumber > totalPages ? 1 : pageNumber;

    const jobs = await Job.find(query)
      .skip((pageNum - 1) * limitNumber)
      .limit(limitNumber);

    res.json({
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
      error: 'Failed to fetch Jobs',
      details: error.message,
    });
  }
};

/* ============================================================
   EXPORT: GET JOBS WITH PAGINATION
   ============================================================ */
const getJobs = (req, res) => paginationForJobs(req, res);

/* ============================================================
   JOB SUMMARIES
   ============================================================ */
const getJobSummaries = async (req, res) => {
  const { search = '', category = '', position = '' } = req.query;

  try {
    const conditions = [];

    if (search && search.trim() !== '') {
      const searchString = search.trim();
      conditions.push({
        $or: [
          { title: { $regex: new RegExp(searchString, 'i') } },
          { description: { $regex: new RegExp(searchString, 'i') } },
        ],
      });
    }

    if (position && position.trim() !== '') {
      conditions.push({ title: { $in: [position.trim()] } });
    }

    if (category && category.trim() !== '') {
      const categoryList = category.split(',').map((c) => c.trim());
      conditions.push({ category: { $in: categoryList } });
    }

    const query = conditions.length ? { $and: conditions } : {};

    const sortCriteria = {
      displayOrder: 1,
      featured: -1,
      datePosted: -1,
      title: 1,
    };

    const totalJobs = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .select('title category location description datePosted featured jobDetailsLink')
      .sort(sortCriteria);

    res.json({ jobs, totalJobs });
  } catch (error) {
    res.status(500).json({
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

    const sortCriteria = {
      displayOrder: 1,
      featured: -1,
      datePosted: -1,
      title: 1,
    };

    const totalJobs = await Job.countDocuments({});
    const jobs = await Job.find({})
      .sort(sortCriteria)
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    res.json({
      jobs,
      pagination: {
        totalJobs,
        totalPages: Math.ceil(totalJobs / limitNumber),
        currentPage: pageNumber,
        limit: limitNumber,
        hasNextPage: pageNumber < Math.ceil(totalJobs / limitNumber),
        hasPreviousPage: pageNumber > 1,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset filters', details: error.message });
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
    res.status(500).json({ error: 'Failed to fetch job', details: error.message });
  }
};

const createJob = async (req, res) => {
  const { title, category, description, imageUrl, location, applyLink, jobDetailsLink } = req.body;

  try {
    const highestOrderJob = await Job.findOne().sort({ displayOrder: -1 }).limit(1);
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
    res.status(500).json({ error: 'Failed to create job', details: error.message });
  }
};

const updateJob = async (req, res) => {
  const { id } = req.params;

  try {
    const updatedJob = await Job.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedJob) return res.status(404).json({ error: 'Job not found' });
    res.json(updatedJob);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update job', details: error.message });
  }
};

const deleteJob = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedJob = await Job.findByIdAndDelete(id);
    if (!deletedJob) return res.status(404).json({ error: 'Job not found' });
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete job', details: error.message });
  }
};

const reorderJobs = async (req, res) => {
  const { jobIds } = req.body;

  try {
    if (!Array.isArray(jobIds) || jobIds.length === 0)
      return res.status(400).json({ error: 'Invalid job order data' });

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
    res.status(500).json({ error: 'Failed to reorder jobs', details: error.message });
  }
};

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
