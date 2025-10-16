const HoursPledged = require('../../models/jobAnalytics/hoursPledged');

const hoursPledgedController = function () {
  const getHoursPledged = async (req, res) => {
    try {
      const { startDate, endDate, roles } = req.query;

      const query = {};
      if (startDate) query.pledge_date = { $gte: new Date(startDate) };
      if (endDate) query.pledge_date = { ...query.pledge_date, $lte: new Date(endDate) };
      if (roles) query.role = { $in: roles.split(',') };

      const hoursPledgedData = await HoursPledged.find(query).sort({ pledge_date: 1 });

      return res.status(200).json(hoursPledgedData);
    } catch (error) {
      console.error('Error fetching hours pledged data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  const addHoursPledged = async (req, res) => {
    try {
      const { role, pledge_date, hrsPerRole } = req.body;

      if (!role || !pledge_date || hrsPerRole === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const newHoursPledged = new HoursPledged({
        role,
        pledge_date: new Date(pledge_date),
        hrsPerRole,
      });

      await newHoursPledged.save();

      return res.status(201).json({ message: 'Data added successfully', data: newHoursPledged });
    } catch (error) {
      console.error('Error adding hours pledged data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  return {
    getHoursPledged,
    addHoursPledged,
  };
};

module.exports = hoursPledgedController;