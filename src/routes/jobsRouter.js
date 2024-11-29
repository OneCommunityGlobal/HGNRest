const express = require('express');
const jobsController = require('../controllers/jobsController'); // Adjust the path if needed

const router = express.Router();

// Define routes
router.get('/', jobsController.getJobs);
router.get('/summaries', jobsController.getJobSummaries); // GET request to fetch job summaries
router.get('/:id', jobsController.getJobById);
router.post('/', jobsController.createJob);
router.put('/:id', jobsController.updateJob);
router.delete('/:id', jobsController.deleteJob);
module.exports = router;
