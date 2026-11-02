const express = require('express');
const jobsController = require('../controllers/jobsController'); // Adjust the path if needed

const router = express.Router();

// Define routes
router.get('/suggestions', jobsController.getJobTitleSuggestions);
router.get('/reset-filters', jobsController.resetJobsFilters);
router.get('/summaries', jobsController.getJobSummaries);
router.get('/categories', jobsController.getCategories);
// Distinct active job titles from the jobs collection — used by the job application form
router.get('/positions', jobsController.getActiveJobPositions);
// Position names from JobPositionCategory (filter/search use)
router.get('/position-categories', jobsController.getPositions);
router.get('/', jobsController.getJobs);
router.get('/:id', jobsController.getJobById);
router.post('/', jobsController.createJob);
router.put('/:id', jobsController.updateJob);
router.delete('/:id', jobsController.deleteJob);
router.post('/reorder', jobsController.reorderJobs);

module.exports = router;
