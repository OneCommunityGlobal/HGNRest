const moment = require('moment');

const injuriesController = (injury) => {
  /**
   * Get injuries over time with filters
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const getInjuriesOverTime = async (req, res) => {
    try {
      const { projectId, startDate, endDate, types, departments, severities } = req.query;

      // Validate required parameters
      if (!projectId || !startDate || !endDate) {
        return res.status(400).json({
          error: 'Missing required parameters: projectId, startDate, and endDate are required'
        });
      }

      // Build the filter object
      const filter = {
        projectId: projectId,
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };

      // Add optional filters
      if (types) {
        const typeArray = types.split(',').map(t => t.trim());
        filter.injuryType = { $in: typeArray };
      }

      if (departments) {
        const deptArray = departments.split(',').map(d => d.trim());
        filter.department = { $in: deptArray };
      }

      if (severities) {
        const sevArray = severities.split(',').map(s => s.trim());
        filter.severity = { $in: sevArray };
      }

      // Aggregate injuries by date
      const injuriesData = await injury.aggregate([
        { $match: filter },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$date" }
            },
            totalInjuries: { $sum: 1 }
          }
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            totalInjuries: 1
          }
        },
        { $sort: { date: 1 } }
      ]);

      // Fill in missing dates with zero injuries
      const startMoment = moment(startDate);
      const endMoment = moment(endDate);
      const dateMap = new Map();

      // Create a map of existing data
      injuriesData.forEach(item => {
        dateMap.set(item.date, item.totalInjuries);
      });

      // Generate complete date range
      const completeData = [];
      const currentDate = startMoment.clone();

      while (currentDate.isSameOrBefore(endMoment)) {
        const dateStr = currentDate.format('YYYY-MM-DD');
        completeData.push({
          date: dateStr,
          totalInjuries: dateMap.get(dateStr) || 0
        });
        currentDate.add(1, 'day');
      }

      res.json(completeData);
    } catch (error) {
      console.error('Error fetching injuries over time:', error);
      res.status(500).json({ error: 'Failed to fetch injuries data' });
    }
  };

  /**
   * Get filter options for injuries
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const getFilterOptions = async (req, res) => {
    try {
      const injuryTypes = ['Cut', 'Burn', 'Fall', 'Strain', 'Fracture', 'Bruise', 'Other'];
      const departments = ['Plumbing', 'Electrical', 'Structural', 'Mechanical', 'General'];
      const severityLevels = ['Minor', 'Moderate', 'Severe', 'Critical'];

      res.json({
        injuryTypes,
        departments,
        severityLevels
      });
    } catch (error) {
      console.error('Error fetching filter options:', error);
      res.status(500).json({ error: 'Failed to fetch filter options' });
    }
  };

  /**
   * Create a new injury record
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const createInjury = async (req, res) => {
    try {
      const injuryData = req.body;
      
      // Validate required fields
      if (!injuryData.projectId || !injuryData.date || !injuryData.injuryType || 
          !injuryData.department || !injuryData.severity) {
        return res.status(400).json({
          error: 'Missing required fields: projectId, date, injuryType, department, and severity are required'
        });
      }

      const newInjury = new injury(injuryData);
      await newInjury.save();

      res.status(201).json({
        success: true,
        data: newInjury
      });
    } catch (error) {
      console.error('Error creating injury record:', error);
      res.status(500).json({ error: 'Failed to create injury record' });
    }
  };

  /**
   * Get all injuries for a project
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const getProjectInjuries = async (req, res) => {
    try {
      const { projectId } = req.params;
      
      const injuries = await injury.find({ projectId })
        .populate('employeeId', 'firstName lastName')
        .populate('reportedBy', 'firstName lastName')
        .sort({ date: -1 })
        .lean();

      res.json({
        success: true,
        data: injuries
      });
    } catch (error) {
      console.error('Error fetching project injuries:', error);
      res.status(500).json({ error: 'Failed to fetch project injuries' });
    }
  };

  return {
    getInjuriesOverTime,
    getFilterOptions,
    createInjury,
    getProjectInjuries
  };
};

module.exports = injuriesController;