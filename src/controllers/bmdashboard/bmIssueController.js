const mongoose = require('mongoose');

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

    // const bmGetIssueChart = async (req, res) => {
    //     try {
    //         const { issueType, year } = req.query;
    //         let matchQuery = {}; // Initialize an empty match query object
    //         let groupFields = {}; // Initialize group fields
    
    //         // Apply filters if provided
    //         if (issueType) {
    //             matchQuery.issueType = issueType;
    //         }
    //         if (year) {
    //             const startDate = new Date(`${year}-01-01T00:00:00Z`);
    //             const endDate = new Date(`${year}-12-31T23:59:59Z`);
    //             matchQuery.issueDate = { $gte: startDate, $lte: endDate }; // Filter based on issueDate
    //         }
    
    //         // Define the $group stage for grouping by issueType and year of issueDate
    //         groupFields = {
    //             _id: {
    //                 issueType: "$issueType",  // Group by issueType
    //                 issueYear: { $year: "$issueDate" }, // Extract year from issueDate and group by year
    //             },
    //             count: { $sum: 1 }, // Count the number of issues per group
    //         };
    
    //         const aggregationPipeline = [
    //             { $match: matchQuery },  // Match the filtered data
    //             { $group: groupFields },  // Group by issueType and issueYear
    //             { $sort: { "_id.issueYear": 1, "_id.issueType": 1 } }, // Sort by issueYear and issueType
    //         ];
    
    //         const issues = await mongoose.model('buildingIssue').aggregate(aggregationPipeline); // Execute the aggregation pipeline
    
    //         res.status(200).json(issues);
    //     } catch (error) {
    //         console.error('Error fetching issues:', error);
    //         res.status(500).json({ message: 'Server error', error });
    //     }
    // };

    const bmGetIssueChart = async (req, res) => {
        try {
            const { issueType, year } = req.query;
            let matchQuery = {}; // Initialize an empty match query object
    
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

    return { bmGetIssue, bmPostIssue, bmGetIssueChart };
};

module.exports = bmIssueController;
