const express = require('express');

const router = express.Router();
const issuesController = require('../../controllers/bmdashboard/IssuesController');

// Routes for Issues

// Get available issue types - must come before parameterized routes to avoid route matching conflicts
router.get('/types', issuesController.getIssueTypes);

// Get issue statistics/breakdown - must come before parameterized routes
router.get('/breakdown', issuesController.getIssueStatistics);

// Parameterized routes - must come after specific routes to avoid matching conflicts
// Get all issues for a project
router.get('/:projectId', issuesController.getIssuesByProject);

// Get issues by type for a project
router.get('/:projectId/:issueType', issuesController.getIssuesByType);

// Create a new issue
router.post('/', issuesController.createIssue);

// Update an existing issue
router.put('/:id', issuesController.updateIssue);

// Delete an issue
router.delete('/:id', issuesController.deleteIssue);

module.exports = router;
