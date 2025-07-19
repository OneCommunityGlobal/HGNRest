const PRReviewInsights = require('../../models/prAnalytics/prReviewsInsights');
const Redis = require('redis');

const redisClient = Redis.createClient();

redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});

exports.getPRReviewInsights = async (req, res) => {
    try {
        const { duration, teams } = req.query;

        console.log('Received query parameters:', { duration, teams });

        const validDurations = ['lastWeek', 'last2weeks', 'lastMonth', 'allTime'];
        if (duration && !validDurations.includes(duration)) {
            return res.status(400).json({ error: 'Invalid duration parameter' });
        }

        const teamCodes = teams ? teams.split(',') : [];
        console.log('Parsed team codes:', teamCodes);

        const query = {};
        const now = new Date();
        if (duration === 'lastWeek') {
            query.reviewDate = { $gte: new Date(now.setDate(now.getDate() - 7)) };
        } else if (duration === 'last2weeks') {
            query.reviewDate = { $gte: new Date(now.setDate(now.getDate() - 14)) };
        } else if (duration === 'lastMonth') {
            query.reviewDate = { $gte: new Date(now.setMonth(now.getMonth() - 1)) };
        }
        if (teamCodes.length > 0) {
            query.teamCode = { $in: teamCodes };
        }

        console.log('Database query:', query);

        const insightsData = await PRReviewInsights.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$teamCode',
                    actionSummary: {
                        $push: {
                            actionTaken: '$actionTaken',
                            count: { $sum: 1 },
                        },
                    },
                    qualityDistribution: {
                        $push: {
                            qualityLevel: '$qualityLevel',
                            count: { $sum: 1 },
                        },
                    },
                },
            },
        ]);

        console.log('Fetched insights data:', insightsData);

        return res.status(200).json({ teams: insightsData });
    } catch (error) {
        console.error('Error fetching PR review insights:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


exports.postPRReviewInsights = async (req, res) => {
    try {
        const { teamCode, reviewDate, actionTaken, qualityLevel } = req.body;

        if (!teamCode || !reviewDate || !actionTaken || !qualityLevel) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const validActions = ['Approved', 'Changes Requested', 'Commented'];
        const validQualityLevels = ['Not approved', 'Low Quality', 'Sufficient', 'Exceptional'];

        if (!validActions.includes(actionTaken)) {
            return res.status(400).json({ error: 'Invalid actionTaken value' });
        }

        if (!validQualityLevels.includes(qualityLevel)) {
            return res.status(400).json({ error: 'Invalid qualityLevel value' });
        }

        // Save the data to the database
        const newInsight = new PRReviewInsights({
            teamCode,
            reviewDate: new Date(reviewDate),
            actionTaken,
            qualityLevel,
        });

        await newInsight.save();

        return res.status(201).json({ message: 'PR review insight saved successfully', data: newInsight });
    } catch (error) {
        console.error('Error saving PR review insight:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};