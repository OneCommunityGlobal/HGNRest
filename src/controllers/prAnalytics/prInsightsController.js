const PRReviewInsights = require('../../models/prReviewInsights');
const Redis = require('redis');

// Initialize Redis client
const redisClient = Redis.createClient();

redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});

exports.getPRReviewInsights = async (req, res) => {
    try {
        const { duration, teams } = req.query;

        // Validate query parameters
        const validDurations = ['lastWeek', 'last2weeks', 'lastMonth', 'allTime'];
        if (duration && !validDurations.includes(duration)) {
            return res.status(400).json({ error: 'Invalid duration parameter' });
        }

        const teamCodes = teams ? teams.split(',') : [];

        // Generate cache key
        const cacheKey = `prReviewInsights:${duration || 'all'}:${teams || 'all'}`;

        // Check Redis cache
        redisClient.get(cacheKey, async (err, cachedData) => {
            if (err) {
                console.error('Redis error:', err);
            }

            if (cachedData) {
                return res.status(200).json(JSON.parse(cachedData));
            }

            // Build query object
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

            // Fetch data from the database
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

            // Cache the result in Redis
            redisClient.setex(cacheKey, 3600, JSON.stringify(insightsData)); // Cache for 1 hour

            return res.status(200).json({ teams: insightsData });
        });
    } catch (error) {
        console.error('Error fetching PR review insights:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};