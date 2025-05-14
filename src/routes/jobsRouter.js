const express = require('express');
const jobsController = require('../controllers/jobsController'); // Adjust the path if needed

const router = express.Router();

// Define routes
router.get('/suggestions', jobsController.getJobTitleSuggestions);
router.get('/reset-filters', jobsController.resetJobsFilters);
router.get('/summaries', jobsController.getJobSummaries);
router.get('/', jobsController.getJobs);
router.get('/categories', jobsController.getCategories);
router.get('/:id', jobsController.getJobById);
router.post('/', jobsController.createJob);
router.put('/:id', jobsController.updateJob);
router.delete('/:id', jobsController.deleteJob);
module.exports = router;
