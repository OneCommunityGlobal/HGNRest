const express = require('express');

const router = express.Router();
const issuesController = require('../../controllers/bmdashboard/IssuesController');

// Routes for Issues

// Get available issue types - must come before parameterized routes
router.get('/types', issuesController.getIssueTypes);

// Get issue statistics - must come before parameterized routes
router.get('/breakdown', issuesController.getIssueStatistics);

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
