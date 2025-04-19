const Job = require('../models/jobs'); // Import the Job model

const paginationForJobs = async (req, res, isSummary) => {
  const { page = 1, limit = 18, search = '', category = '' } = req.query;
  try {
    const pageNumber = Math.max(1, parseInt(page, 10));
    const limitNumber = Math.max(1, parseInt(limit, 10));

    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    if (category) query.category = category;
    const totalJobs = await Job.countDocuments(query);

    let sortCriteria;
    let jobs;

    if (isSummary) {
      sortCriteria = {
        title: 1,
        datePosted: -1,
        featured: -1,
      };

      jobs = await Job.find(query)
        .select('title category location description datePosted featured jobDetailsLink')
        .sort(sortCriteria)
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber);
    } else {
      jobs = await Job.find(query)
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber);
    }

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
    res.status(500).json({ error: 'Failed to fetch Jobs/Summaries', details: error.message });
  }
};

// Controller to fetch all jobs with pagination, search, and filtering
const getJobs = (req, res) => paginationForJobs(req, res, false);

// Controller to fetch job summaries with pagination, search, filtering, and sorting
const getJobSummaries = (req, res) => paginationForJobs(req, res, true);

// Controller to fetch job title suggestions for a dropdown
const getJobTitleSuggestions = async (req, res) => {
  const { query = '' } = req.query;

  try {
    const suggestions = await Job.find({ title: { $regex: query, $options: 'i' } }).distinct(
      'title',
    );

    res.json({ suggestions });
  } catch (error) {
    res
      .status(500)
      .json({ error: 'Failed to fetch job title suggestions', details: error.message });
  }
};

const resetJobsFilters = async (req, res) => {
  const { page = 1, limit = 18 } = req.query;

  try {
    // Validate pagination parameters
    const pageNumber = Math.max(1, parseInt(page, 10));
    const limitNumber = Math.max(1, parseInt(limit, 10));

    // Sorting logic
    const sortCriteria = {
      title: 1,
      datePosted: -1,
      featured: -1,
    };
    // Fetch all jobs without filtering
    const totalJobs = await Job.countDocuments({});
    const jobs = await Job.find({})
      .sort(sortCriteria)
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    // Respond with all jobs and pagination metadata
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
    res
      .status(500)
      .json({ error: 'Failed to reset filters or reload jobs', details: error.message });
  }
};

const getCategories = async (req, res) => {
  try {
    const categories = await Job.distinct('category', {});

    // Sort categories alphabetically
    categories.sort((a, b) => a.localeCompare(b));

    res.status(200).json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
};
// Controller to fetch job details by ID
const getJobById = async (req, res) => {
  const { id } = req.params;

  try {
    const job = await Job.findById(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job', details: error.message });
  }
};

// Controller to create a new job
const createJob = async (req, res) => {
  const { title, category, description, imageUrl, location, applyLink, jobDetailsLink } = req.body;

  try {
    const newJob = new Job({
      title,
      category,
      description,
      imageUrl,
      location,
      applyLink,
      jobDetailsLink,
    });

    const savedJob = await newJob.save();
    res.status(201).json(savedJob);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create job', details: error.message });
  }
};

// Controller to update an existing job by ID
const updateJob = async (req, res) => {
  const { id } = req.params;

  try {
    const updatedJob = await Job.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedJob) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json(updatedJob);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update job', details: error.message });
  }
};

// Controller to delete a job by ID
const deleteJob = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedJob = await Job.findByIdAndDelete(id);
    if (!deletedJob) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete job', details: error.message });
  }
};

// Export controllers as a plain object
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
};
