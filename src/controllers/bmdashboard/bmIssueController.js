const mongoose = require('mongoose');

const bmIssueController = function (BuildingIssue, injuryIssue) {

    const bmGetIssue = async (req, res) => {
        try {
        BuildingIssue.find()
            .populate()
            .then((result) => res.status(200).send(result))
            .catch((error) => res.status(500).send(error));
        } catch (err) {
        res.json(err);
        }
    };

    // Injury Issue
    const bmPostInjuryIssue = async (req, res) => {
        try {
            const issue = await injuryIssue.create(req.body);
            return res.status(201).json(issue);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    };
    
    // Fetch all injury issues (with assigned user’s name)
    const bmGetInjuryIssue = async (req, res) => {
        try {
            const issues = await injuryIssue
                .find()
                .populate('assignedTo', 'firstName lastName _id');
            return res.status(200).json(issues);
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    };
    
    // Delete an issue by its ID (_id)
    const bmDeleteInjuryIssue = async (req, res) => {
        try {
            const { id } = req.params;
            const deleted = await injuryIssue.findByIdAndDelete(id);
            if (!deleted) {
                return res.status(404).json({ message: 'Issue not found' });
            }
            return res.status(200).json({ message: 'Deleted successfully', deleted });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    };
    
    // Rename (update the name) of an issue by its ID
    const bmRenameInjuryIssue = async (req, res) => {
        try {
            const { id } = req.params; 
            const { newName } = req.body;
            if (!newName) {
                return res.status(400).json({ message: 'newName is required' });
            }
            const updated = await injuryIssue.findByIdAndUpdate(
                id,
                { name: newName },
                { new: true, runValidators: true }
            );
            if (!updated) {
                return res.status(404).json({ message: 'Issue not found' });
            }
            return res.status(200).json({ message: 'Renamed successfully', updated });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    };
    
    // Copy an existing issue by its ID
    const bmCopyInjuryIssue = async (req, res) => {
        try {
            const { id } = req.params;
            const original = await injuryIssue.findById(id).lean();
            if (!original) {
                return res.status(404).json({ message: 'Issue not found' });
            }
    
            // Build copy data
            const copyData = {
                projectId:original.projectId,
                name: `${original.name} (Copy)`,
                openDate: Date.now(),
                category: original.category,
                assignedTo: original.assignedTo,
                totalCost: original.totalCost
            };
    
            const copy = await injuryIssue.create(copyData);
            return res.status(201).json({ message: 'Copied successfully', copy });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    };

    const bmGetIssueChart = async (req, res) => {
        try {
            const { issueType, year } = req.query;
            const matchQuery = {}; // Initialize an empty match query object
    
            // Apply filters if provided
            if (issueType) {
                matchQuery.issueType = issueType;
            }
            if (year) {
                const startDate = new Date(`${year}-01-01T00:00:00Z`);
                const endDate = new Date(`${year}-12-31T23:59:59Z`);
                matchQuery.issueDate = { $gte: startDate, $lte: endDate }; // Filter based on issueDate
            }
    
            const aggregationPipeline = [
                { $match: matchQuery },  // Match the filtered data
                {
                    $group: {
                        _id: { issueType: "$issueType", year: { $year: "$issueDate" } },
                        count: { $sum: 1 } // Properly count occurrences
                    }
                },
                {
                    $group: {
                        _id: "$_id.issueType",
                        years: {
                            $push: {
                                year: "$_id.year",
                                count: "$count"
                            }
                        }
                    }
                },
                { $sort: { "_id": 1 } }, // Sort by issueType
            ];
    
            const issues = await mongoose.model('buildingIssue').aggregate(aggregationPipeline); // Execute aggregation pipeline
    
            // Format the result
            const result = issues.reduce((acc, item) => {
                const issueType = item._id;
                acc[issueType] = {};
                item.years.forEach(yearData => {
                    acc[issueType][yearData.year] = yearData.count;
                });
                return acc;
            }, {});
    
            res.status(200).json(result); // Return the formatted result
        } catch (error) {
            console.error('Error fetching issues:', error);
            res.status(500).json({ message: 'Server error', error });
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

    return {
        bmGetIssue,
        bmPostInjuryIssue,
        bmGetInjuryIssue,
        bmDeleteInjuryIssue,
        bmRenameInjuryIssue,
        bmCopyInjuryIssue,
        bmGetIssueChart,
        bmPostIssue
    };

};

module.exports = bmIssueController;
