const mongoose = require('mongoose');
const BuildingIssue = require('../../models/bmdashboard/buildingIssue');
const BuildingProject = require('../../models/bmdashboard/buildingProject');

const bmIssueController = function (BuildingIssue) {
    const bmGetIssue = async (req, res) => {
        try {
            BuildingIssue
            .find()
            .populate()
            .then((result) => res.status(200).send(result))
            .catch((error) => res.status(500).send(error));
        } catch (err) {
            res.json(err);
        }
    };

    const bmPostIssue = async (req, res) => {
        try {
            const newIssue = BuildingIssue.create(req.body)
            .then((result) => res.status(201).send(result))
            .catch((error) => res.status(500).send(error));
        } catch (err) {
            res.json(err);
        }
    };

    const getLongestOpenIssues = async (req, res) => {
        try {
            const { dates, projects } = req.query;
            // dates = '2021-10-01,2023-11-03';
            // projects = '654946c8bc5772e8caf7e963';
            const query = { status: 'open' };
            let filteredProjectIds = [];
    
            // Parse project filter if provided
            if (projects) {
                filteredProjectIds = projects.split(',').map(id => id.trim());
            }
    
            // Apply date filtering logic
            if (dates) {
                const [startDateStr, endDateStr] = dates.split(',').map(d => d.trim());
                const startDate = new Date(startDateStr);
                const endDate = new Date(endDateStr);
    
                const matchingProjects = await BuildingProject.find({
                    dateCreated: { $gte: startDate, $lte: endDate },
                    isActive: true
                }).select('_id').lean();
    
                const dateFilteredIds = matchingProjects.map(p => p._id.toString());
    
                if (filteredProjectIds.length > 0) {
                    // Intersection of project filters
                    filteredProjectIds = filteredProjectIds.filter(id =>
                        dateFilteredIds.includes(id)
                    );
                } else {
                    filteredProjectIds = dateFilteredIds;
                }
            }
    
            // If no matching project IDs, return early
            if (dates && filteredProjectIds.length === 0) {
                return res.json([]); // No results to return
            }
    
            if (filteredProjectIds.length > 0) {
                query.projectId = { $in: filteredProjectIds };
            }
    
            let issues = await BuildingIssue.find(query)
                .select('issueTitle issueDate')
                .populate('projectId')
                .lean();
    
            issues = issues.map(issue => {
                const durationInMonths = Math.ceil(
                    (new Date() - new Date(issue.issueDate)) / (1000 * 60 * 60 * 24 * 30.44)
                );
                const years = Math.floor(durationInMonths / 12);
                const months = durationInMonths % 12;
                const durationText = years > 0
                    ? `${years} year${years > 1 ? 's' : ''} ${months} month${months > 1 ? 's' : ''}`
                    : `${months} month${months > 1 ? 's' : ''}`;
    
                return {
                    issueName: issue.issueTitle[0],
                    durationOpen: durationText,
                    durationInMonths
                };
            });
    
            const topIssues = issues
                .sort((a, b) => b.durationInMonths - a.durationInMonths)
                .slice(0, 7)
                .map(({ issueName, durationInMonths }) => ({
                    issueName,
                    durationOpen: durationInMonths, // send number only
                  }));
                  
    
            res.json(topIssues);
        } catch (error) {
            console.error('Error fetching longest open issues:', error);
            res.status(500).json({ message: 'Error fetching longest open issues' });
        }
    };

    return { bmGetIssue, bmPostIssue, getLongestOpenIssues};
};

module.exports = bmIssueController;
