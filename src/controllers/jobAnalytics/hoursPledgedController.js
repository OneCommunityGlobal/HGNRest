const HoursPledged = require('../../models/hoursPledged');
const Redis = require('redis');

// Initialize Redis client
const redisClient = Redis.createClient();

redisClient.on('error', (err) => {
  console.error('Redis error:', err);
});

exports.getHoursPledged = async (req, res) => {
  try {
    const { startDate, endDate, roles } = req.query;

    // Generate a cache key based on query parameters
    const cacheKey = `hoursPledged:${startDate || 'all'}:${endDate || 'all'}:${roles || 'all'}`;

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
      if (startDate) query.pledge_date = { $gte: new Date(startDate) };
      if (endDate) query.pledge_date = { ...query.pledge_date, $lte: new Date(endDate) };
      if (roles) query.role = { $in: roles.split(',') };

      // Fetch data from the database
      const hoursPledgedData = await HoursPledged.find(query);

      // Cache the result in Redis
      redisClient.setex(cacheKey, 3600, JSON.stringify(hoursPledgedData)); // Cache for 1 hour

      return res.status(200).json(hoursPledgedData);
    });
  } catch (error) {
    console.error('Error fetching hours pledged data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};