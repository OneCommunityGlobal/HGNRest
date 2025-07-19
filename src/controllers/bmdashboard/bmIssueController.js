const { ObjectId } = require('mongoose').Types;

const bmIssueController = function (buildingIssue) {
    //fetch open issues with optional date range and tag filtering and project ID
    const bmGetIssue = async (req, res) => {
        try {
            const { projectIds, startDate, endDate, tag } = req.query;

            let query = { status: 'open' }; // Always filter for open issues

            // Handle projectIds if provided
            if (projectIds) {
                const projectIdArray = projectIds.split(',').map(id => id.trim());
                const validProjectIds = projectIdArray.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
                if (validProjectIds.length > 0) {
                    query.projectId = { $in: validProjectIds };
                }
            }

            // Build date filter
            if (startDate && endDate) {
                query.createdDate = {
                    $gte: new Date(startDate),
                    $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
                };
            } else if (startDate) {
                query.createdDate = { $gte: new Date(startDate) };
            } else if (endDate) {
                query.createdDate = { $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) };
            }

            // Add tag filter if provided
            if (tag) {
                query.tag = tag;
            }

            // Fetch open issues
            const results = await buildingIssue.find(query);
            return res.json(results || []);
        } catch (error) {
            console.error('Error fetching issues:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    };



    // Fetch unique project IDs and their names
    const getUniqueProjectIds = async (req, res) => {
        try {
            // Use aggregation to get distinct project IDs and lookup their names
            const results = await buildingIssue.aggregate([
                {
                    $group: {
                        _id: '$projectId',
                    },
                },
                {
                    $lookup: {
                        from: 'buildingProjects',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'projectDetails',
                    },
                },
                {
                    $project: {
                        _id: 1,
                        projectName: { $arrayElemAt: ['$projectDetails.name', 0] },
                    },
                },
                {
                    $sort: { projectName: 1 },
                },
            ]);

            // Format the response
            const formattedResults = results.map((item) => ({
                projectId: item._id,
                projectName: item.projectName || 'Unknown Project',
            }));

            return res.json(formattedResults);
        } catch (error) {
            console.error('Error fetching unique project IDs:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    };


    const bmPostIssue = async (req, res) => {
        try {
            buildingIssue.create(req.body)
                .then((result) => {
                    res.status(201).send(result)
                })
                .catch((error) => {
                    res.status(500).send(error)
                });
        } catch (err) {
            res.json(err);
        }
    };

    // Update an existing issue
    const bmUpdateIssue = async (req, res) => {
        try {

            const updates = req.body;

            if (!updates || typeof updates !== 'object') {
                return res.status(400).json({ message: 'Invalid update data.' });
            }

            buildingIssue.findByIdAndUpdate(
                req.params.id,
                { $set: updates },
                { new: true }
            )
                .then(updatedIssue => {
                    if (!updatedIssue) {
                        return res.status(404).json({ message: 'Issue not found.' });
                    }
                    res.json(updatedIssue);
                })
                .catch(err => res.status(500).json({ error: err.message }));
        } catch (error) {
            res.json({ error: error.message });
        }
    };

    // Delete an issue by ID
    const bmDeleteIssue = (req, res) => {
        const { id } = req.params;

        buildingIssue.findByIdAndDelete(id)
            .then((deletedIssue) => {
                if (!deletedIssue) {
                    return res.status(404).json({ message: 'Issue not found.' });
                }
                res.json({ message: 'Issue deleted successfully.' });
            })
            .catch((err) => res.status(500).json({ error: err.message }));
    };

    return { bmGetIssue, bmPostIssue, bmUpdateIssue, bmDeleteIssue, getUniqueProjectIds };
};

module.exports = bmIssueController;
