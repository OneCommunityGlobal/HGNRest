const HoursPledged = require('../../models/jobAnalytics/hoursPledged');

const hoursPledgedController = function () {
  const getHoursPledged = async (req, res) => {
    try {
      const { startDate, endDate, roles } = req.query;

      const query = {};
      if (startDate) query.pledgeDate = { $gte: new Date(startDate) };
      if (endDate) query.pledgeDate = { ...query.pledgeDate, $lte: new Date(endDate) };
      if (roles) query.role = { $in: roles.split(',') };

      const hoursPledgedData = await HoursPledged.find(query).sort({ pledgeDate: 1 });

      return res.status(200).json(hoursPledgedData);
    } catch (error) {
      console.error('Error fetching hours pledged data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  const addHoursPledged = async (req, res) => {
    try {
      const { role, pledgeDate, hrsPerRole } = req.body;

      if (!role || !pledgeDate || hrsPerRole === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const newHoursPledged = new HoursPledged({
        role,
        pledgeDate: new Date(pledgeDate),
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