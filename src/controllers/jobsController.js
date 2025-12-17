const Job = require('../models/jobs'); // Import the Job model
const JobPositionCategory = require('../models/jobPositionCategory');
const JobForms = require('../models/JobFormsModel');
// const { hasPermission, canRequestorUpdateUser } = require('../utilities/permissions');
const helper = require('../utilities/permissions');

function getWordCount(input) {
  const excludedSymbols = new Set(['.', '#', '$', '*', '-', '–', '—', '_']);

  const wordCount = input
    .trim()
    .split(/\s+/) // still use this to handle any whitespace
    .filter((word) => {
      // Remove empty strings and standalone symbols
      const cleanedWord = word.trim();
      return cleanedWord && !excludedSymbols.has(cleanedWord);
    }).length;

  return wordCount;
}
const EIGHTEEN = 18;
// Controller to fetch all jobs with pagination, search, and filtering
const paginationForJobs = async (req, res) => {
  const { page = 1, limit = EIGHTEEN, search = '', category = '', position = '' } = req.query;

  try {
    // Validate query parameters
    const pageNumber = Math.max(1, parseInt(page, 10)); // Ensure page is at least 1
    const limitNumber = Math.max(1, parseInt(limit, 10)); // Ensure limit is at least 1

    // Build query conditions
    const conditions = [];
    const [allCategories, allPositions] = await Promise.all([
      JobPositionCategory.distinct('category'),
      JobPositionCategory.distinct('position'),
    ]);

    if (search) {
      const searchString = String(search);
      conditions.push({
        $or: [
          { title: { $regex: new RegExp(searchString, 'i') } },
          { description: { $regex: new RegExp(searchString, 'i') } },
        ],
      });
    } // Case-insensitive search

    if (position) conditions.push({ title: { $in: [position] } });

    if (category) conditions.push({ category: { $in: [category] } });

    if (allCategories.length) conditions.push({ category: { $in: allCategories } });
    if (allPositions.length) conditions.push({ title: { $in: allPositions } });
    // Final query

    const query = conditions.length ? { $and: conditions } : {};
    const totalJobs = await Job.countDocuments(query);

    const totalPages = Math.ceil(totalJobs / limitNumber); // was 20

    let pageNum;
    if (pageNumber > totalPages) pageNum = 1;
    else pageNum = pageNumber;
    // Fetch paginated results
    const jobs = await Job.find(query)
      .skip((pageNum - 1) * limitNumber)
      .limit(limitNumber);

    // Prepare response
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
const getJobSummaries = async (req, res) => {
  const { search = '', category = '', position = '' } = req.query;

  try {
    // Build query conditions
    const conditions = [];
    const [allCategories, allPositions] = await Promise.all([
      JobPositionCategory.distinct('category'),
      JobPositionCategory.distinct('position'),
    ]);

    if (search) {
      const searchString = String(search);
      conditions.push({
        $or: [
          { title: { $regex: new RegExp(searchString, 'i') } },
          { description: { $regex: new RegExp(searchString, 'i') } },
        ],
      });
    } // Case-insensitive search

    if (position) conditions.push({ title: { $in: [position] } });

    if (category) conditions.push({ category: { $in: [category] } });

    if (allCategories.length) conditions.push({ category: { $in: allCategories } });
    if (allPositions.length) conditions.push({ title: { $in: allPositions } });
    // Final query

    const query = conditions.length ? { $and: conditions } : {};

    // Sorting logic
    const sortCriteria = {
      displayOrder: 1,
      featured: -1,
      datePosted: -1,
      title: 1,
    };

    // Fetch the total number of jobs matching the query for pagination
    const totalJobs = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .select('title category location description datePosted featured jobDetailsLink')
      .sort(sortCriteria);

    res.json({
      jobs,
      totalJobs,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch job summaries', details: error.message });
  }
};

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
  const { page = 1, limit = EIGHTEEN } = req.query;

  try {
    // Validate pagination parameters
    const pageNumber = Math.max(1, parseInt(page, 10));
    const limitNumber = Math.max(1, parseInt(limit, 10));

    // Sorting logic
    const sortCriteria = {
      displayOrder: 1,
      featured: -1,
      datePosted: -1,
      title: 1,
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
    //    const categories = await Job.distinct('category', {});
    const categories = await JobPositionCategory.distinct('category', {});
    // Sort categories alphabetically
    categories.sort((a, b) => a.localeCompare(b));

    res.status(200).json({ categories });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
};
const getPositions = async (req, res) => {
  try {
    const categoryIn = req?.query?.category || '';
    const filterCategory = categoryIn ? { category: categoryIn } : {};

    const positions = await JobPositionCategory.distinct('position', filterCategory);

    // Sort categories alphabetically
    positions.sort((a, b) => a.localeCompare(b));

    res.status(200).json({ positions });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch positions' });
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

const MIN_WORDS = 30;

// Need to check permision here
const checkPermission = async function (req, permission) {
  return helper.hasPermission(req.body.requestor, permission);
};

const validateCategory = async function (category) {
  const result = await JobPositionCategory.find({ category });
  if (!result || result.length === 0) {
    return { error: 'Category not found' };
  }
  return null;
};
const validateTitle = async function (title) {
  const jobPosition = await JobPositionCategory.find({ position: title });
  if (!jobPosition || jobPosition.length === 0) {
    return { error: 'Title not found' };
  }
  return null;
};
const validateTitleCategoryMatch = async function (title, category) {
  const jobPositionCategory = await JobPositionCategory.find({ position: title, category });
  if (!jobPositionCategory || jobPositionCategory.length === 0) {
    return { error: 'Title and Category not matched' };
  }
  return null;
};
const validateApplyLink = async function (applyLink) {
  const formId = applyLink.split('jobforms/')[1];

  const jobForms = await JobForms.find({ _id: formId });
  if (!jobForms || jobForms.length === 0) {
    return { error: 'Mismatched ApplyLink' };
  }
  return null;
};

// Controller to create a new job
const createJob = async (req, res) => {
  const {
    title,
    category,
    description,
    imageUrl,
    // location,
    applyLink,
    // jobDetailsLink,
    requirements,
    projects,
    ourCommunity,
  } = req.body;
  if (!(await checkPermission(req, 'createCollabJobAds')))
    return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
  // Validate Category and Position

  const categoryValidation = await validateCategory(category);
  if (categoryValidation) {
    res.status(500).json(categoryValidation);
  }

  const titleValidation = await validateTitle(title);
  if (titleValidation) {
    res.status(500).json(titleValidation);
  }

  const titleCategoryMatch = await validateTitleCategoryMatch(title, category);
  if (titleCategoryMatch) {
    return res.status(404).json(titleCategoryMatch);
  }

  const applyLinkValidation = await validateApplyLink(applyLink);
  if (applyLinkValidation) {
    return res.status(404).json(applyLinkValidation);
  }

  //  desctiption word count should be >= 30
  const descriptionWordCount = getWordCount(description);

  if (descriptionWordCount < MIN_WORDS) {
    return res.status(403).json({
      error: `Please enter a minimum of ${MIN_WORDS} words for description`,
    });
  }

  //  requirements word count should be >= 30
  const requirementsWordCount = getWordCount(requirements);

  if (requirementsWordCount < MIN_WORDS) {
    return res.status(403).json({
      error: `Please enter a minimum of ${MIN_WORDS} words for Requireents`,
    });
  }

  //  projects is required
  if (!projects || projects.length === 0) {
    return res.status(403).json({
      error: 'Please enter at least one project',
    });
  }
  const ourCommunityWordCount = getWordCount(ourCommunity);

  if (ourCommunityWordCount < MIN_WORDS) {
    return res.status(403).json({
      error: `Please enter a minimum of ${MIN_WORDS} words for ourCommunity`,
    });
  }

  try {
    // Find the highest displayOrder value currently in use
    const highestOrderJob = await Job.findOne().sort({ displayOrder: -1 }).limit(1);
    const newDisplayOrder = highestOrderJob ? highestOrderJob.displayOrder + 1 : 0;

    const newJob = new Job({
      title,
      category,
      description,
      imageUrl,
      location: 'remote',
      applyLink,
      //      jobDetailsLink,
      displayOrder: newDisplayOrder,
      requirements,
      projects,
      ourCommunity,
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

// Controller to reorder jobs
const reorderJobs = async (req, res) => {
  const { jobIds } = req.body;

  try {
    // Validate input
    if (!Array.isArray(jobIds) || jobIds.length === 0) {
      return res.status(400).json({ error: 'Invalid job order data' });
    }

    // Update the order of each job
    const updateOperations = jobIds.map((jobId, index) => ({
      updateOne: {
        filter: { _id: jobId },
        update: { $set: { displayOrder: index } },
      },
    }));

    await Job.bulkWrite(updateOperations);

    // Fetch and return the updated jobs
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
  reorderJobs,
  getPositions,
};
