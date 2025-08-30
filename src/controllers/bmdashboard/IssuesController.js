const Issue = require('../../models/bmdashboard/Issues');

// Get all issues for a specific project
exports.getIssuesByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const issues = await Issue.find({ projectId });
    res.json(issues);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get issues by type for a specific project
exports.getIssuesByType = async (req, res) => {
  try {
    const { projectId, issueType } = req.params;
    const issues = await Issue.find({ projectId, issueType });
    res.json(issues);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new issue
exports.createIssue = async (req, res) => {
  try {
    const issue = new Issue({
      projectName: req.body.projectName,
      equipmentIssues: req.body.equipmentIssues || 0,
      laborIssues: req.body.laborIssues || 0,
      materialIssues: req.body.materialIssues || 0
    });
    await issue.save();
    res.status(201).json(issue);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update an existing issue
exports.updateIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const issue = await Issue.findByIdAndUpdate(id, updates, { new: true });
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }
    res.json(issue);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete an issue
exports.deleteIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const issue = await Issue.findByIdAndDelete(id);
    if (!issue) {
      return res.status(404).json({ message: 'Issue not found' });
    }
    res.json({ message: 'Issue deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get issue statistics for all projects
exports.getIssueStatistics = async (req, res) => {
  try {
    const statistics = await Issue.aggregate([
      // Project the final output
      { $project: {
        projectId: 1,
        projectName: 1,
        equipmentIssues: 1,
        laborIssues: 1,
        materialIssues: 1,
        totalIssues: { 
          $add: ["$equipmentIssues", "$laborIssues", "$materialIssues"] 
        }
      }}
    ]);
    res.json(statistics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
