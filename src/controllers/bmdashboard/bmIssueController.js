const { ObjectId } = require('mongoose').Types;

const BuildingProject = require('../../models/bmdashboard/buildingProject');

const bmIssueController = function (buildingIssue) {
    //fetch open issues with optional date range and tag filtering and project ID
    const bmGetOpenIssue = async (req, res) => {
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

    const bmGetIssue = async (req, res) => {
      try {
        buildingIssue.find()
          .populate()
          .then((result) => res.status(200).send(result))
          .catch((error) => res.status(500).send(error));
      } catch (err) {
        res.json(err);
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
          { $match: matchQuery }, // Match the filtered data
          {
            $group: {
              _id: { issueType: '$issueType', year: { $year: '$issueDate' } },
              count: { $sum: 1 }, // Properly count occurrences
            },
          },
          {
            $group: {
              _id: '$_id.issueType',
              years: {
                $push: {
                  year: '$_id.year',
                  count: '$count',
                },
              },
            },
          },
          { $sort: { _id: 1 } }, // Sort by issueType
        ];

        const issues = await buildingIssue.aggregate(aggregationPipeline); // Execute aggregation pipeline

        // Format the result
        const result = issues.reduce((acc, item) => {
          const issueTypeKey = item._id;
          acc[issueTypeKey] = {};
          item.years.forEach((yearData) => {
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

    const getLongestOpenIssues = async (req, res) => {
      try {
        const { dates, projects } = req.query;
        // dates = '2021-10-01,2023-11-03';
        // projects = '654946c8bc5772e8caf7e963';
        const query = { status: 'open' };
        let filteredProjectIds = [];

        // Parse project filter if provided
        if (projects) {
          filteredProjectIds = projects.split(',').map((id) => id.trim());
        }

        // Apply date filtering logic
        if (dates) {
          const [startDateStr, endDateStr] = dates.split(',').map((d) => d.trim());
          const startDate = new Date(startDateStr);
          const endDate = new Date(endDateStr);

          const matchingProjects = await BuildingProject.find({
            dateCreated: { $gte: startDate, $lte: endDate },
            isActive: true,
          })
            .select('_id')
            .lean();

          const dateFilteredIds = matchingProjects.map((p) => p._id.toString());

          if (filteredProjectIds.length > 0) {
            // Intersection of project filters
            filteredProjectIds = filteredProjectIds.filter((id) => dateFilteredIds.includes(id));
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

        let issues = await buildingIssue.find(query)
          .select('issueTitle issueDate')
          .populate('projectId')
          .lean();

        issues = issues.map((issue) => {
          const durationInMonths = Math.ceil(
            (new Date() - new Date(issue.issueDate)) / (1000 * 60 * 60 * 24 * 30.44),
          );
          const years = Math.floor(durationInMonths / 12);
          const months = durationInMonths % 12;
          const durationText =
            years > 0
              ? `${years} year${years > 1 ? 's' : ''} ${months} month${months > 1 ? 's' : ''}`
              : `${months} month${months > 1 ? 's' : ''}`;

          return {
            issueName: issue.issueTitle[0],
            durationOpen: durationText,
            durationInMonths,
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

  return { bmGetOpenIssue, bmUpdateIssue, bmDeleteIssue, getUniqueProjectIds, bmGetIssue, bmPostIssue, bmGetIssueChart, getLongestOpenIssues };
};

module.exports = bmIssueController;
