const Event = require('../models/event');

const eventPopularityController = () => {
  // Calculate popularity metrics by event type
  const getPopularityMetrics = async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      // Build date filter if provided
      const query = { isActive: true };
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
      }

      // Get all events with attendance data
      const events = await Event.find(query).lean();

      // Handle empty events
      if (!events || events.length === 0) {
        return res.json({ metrics: [] });
      }

      // Group by event type
      const typeMetrics = {};

      events.forEach((event) => {
        const type = event.type || 'Unknown';
        if (!typeMetrics[type]) {
          typeMetrics[type] = {
            eventType: type,
            totalEvents: 0,
            totalAttendees: 0,
            totalRegistrations: 0,
            averageAttendeesPerEvent: 0,
            events: [],
          };
        }

        const attendees = event.currentAttendees || 0;
        const registrations = event.currentAttendees || 0; // Using currentAttendees as proxy for registrations

        typeMetrics[type].totalEvents += 1;
        typeMetrics[type].totalAttendees += attendees;
        typeMetrics[type].totalRegistrations += registrations;
        typeMetrics[type].events.push({
          eventId: event._id,
          title: event.title,
          attendees,
          registrations,
          maxAttendees: event.maxAttendees,
          location: event.location,
        });
      });

      // Calculate averages
      const result = Object.values(typeMetrics).map((metrics) => ({
        ...metrics,
        averageAttendeesPerEvent:
          metrics.totalEvents > 0 ? metrics.totalAttendees / metrics.totalEvents : 0,
        averageRegistrationsPerEvent:
          metrics.totalEvents > 0 ? metrics.totalRegistrations / metrics.totalEvents : 0,
      }));

      res.json({ metrics: result });
    } catch (error) {
      console.error('Error in getPopularityMetrics:', error);
      res.status(500).json({
        error: 'Failed to fetch popularity metrics',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  };

  // Calculate engagement metrics (session duration, interactions)
  const getEngagementMetrics = async (req, res) => {
    try {
      const { startDate, endDate, format } = req.query; // format: 'Virtual' or 'In person'

      const query = { isActive: true };
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
      }

      if (format) {
        query.location = format;
      }

      const events = await Event.find(query).lean();

      // Handle empty events
      if (!events || events.length === 0) {
        return res.json({
          engagement: {
            totalEvents: 0,
            totalAttendees: 0,
            averageSessionDuration: 0,
            averageInteractionRate: 0,
            events: [],
          },
        });
      }

      // Calculate session duration based on event start/end times
      const engagementData = events.map((event) => {
        const attendees = event.currentAttendees || 0;

        // Calculate session duration from startTime and endTime
        let averageSessionDuration = 0;
        if (event.startTime && event.endTime) {
          const start = new Date(event.startTime);
          const end = new Date(event.endTime);
          averageSessionDuration = Math.round((end - start) / (1000 * 60)); // Duration in minutes
        } else {
          // Default duration based on event type
          const defaultDurations = {
            Workshop: 120,
            Meeting: 60,
            Webinar: 90,
            'Social Gathering': 90,
          };
          averageSessionDuration = defaultDurations[event.type] || 60;
        }

        const interactionRate = event.maxAttendees > 0 ? (attendees / event.maxAttendees) * 100 : 0;

        return {
          eventId: event._id,
          title: event.title,
          type: event.type,
          location: event.location,
          attendees,
          averageSessionDuration,
          interactionRate: Math.round(interactionRate * 100) / 100,
        };
      });

      const totalAttendees = engagementData.reduce((sum, e) => sum + e.attendees, 0);
      const averageSessionDuration =
        engagementData.length > 0
          ? engagementData.reduce((sum, e) => sum + e.averageSessionDuration, 0) /
            engagementData.length
          : 0;
      const averageInteractionRate =
        engagementData.length > 0
          ? engagementData.reduce((sum, e) => sum + e.interactionRate, 0) / engagementData.length
          : 0;

      res.json({
        engagement: {
          totalEvents: events.length,
          totalAttendees,
          averageSessionDuration: Math.round(averageSessionDuration),
          averageInteractionRate: Math.round(averageInteractionRate * 100) / 100,
          events: engagementData,
        },
      });
    } catch (error) {
      console.error('Error in getEngagementMetrics:', error);
      res.status(500).json({
        error: 'Failed to fetch engagement metrics',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  };

  // Calculate event value (estimated value per event)
  const getEventValue = async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const query = { isActive: true };
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
      }

      const events = await Event.find(query).lean();

      // Handle empty events
      if (!events || events.length === 0) {
        return res.json({
          eventValues: {
            totalValue: 0,
            averageValuePerEvent: 0,
            events: [],
          },
        });
      }

      // Calculate estimated value per event
      // Value calculation: base value per attendee * attendee count
      // Different event types have different base values
      const baseValues = {
        Workshop: 50,
        Meeting: 30,
        Webinar: 25,
        'Social Gathering': 20,
      };

      const eventValues = events.map((event) => {
        const attendees = event.currentAttendees || 0;
        const baseValue = baseValues[event.type] || 30;
        const estimatedValue = attendees * baseValue;

        return {
          eventId: event._id,
          title: event.title,
          type: event.type,
          location: event.location,
          attendees,
          estimatedValue,
          baseValuePerAttendee: baseValue,
        };
      });

      const totalValue = eventValues.reduce((sum, e) => sum + e.estimatedValue, 0);
      const averageValuePerEvent = eventValues.length > 0 ? totalValue / eventValues.length : 0;

      res.json({
        eventValues: {
          totalValue,
          averageValuePerEvent: Math.round(averageValuePerEvent * 100) / 100,
          events: eventValues,
        },
      });
    } catch (error) {
      console.error('Error in getEventValue:', error);
      res.status(500).json({
        error: 'Failed to fetch event values',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  };

  // Get comparison metrics for virtual vs in-person
  const getFormatComparison = async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const virtualQuery = { isActive: true, location: 'Virtual' };
      const inPersonQuery = { isActive: true, location: 'In person' };

      if (startDate || endDate) {
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) dateFilter.$lte = new Date(endDate);
        virtualQuery.date = dateFilter;
        inPersonQuery.date = dateFilter;
      }

      const virtualEvents = await Event.find(virtualQuery).lean();
      const inPersonEvents = await Event.find(inPersonQuery).lean();

      const calculateMetrics = (events) => {
        const totalAttendees = events.reduce(
          (sum, event) => sum + (event.currentAttendees || 0),
          0,
        );
        const totalEvents = events.length;
        const averageAttendees = totalEvents > 0 ? totalAttendees / totalEvents : 0;

        return {
          totalEvents,
          totalAttendees,
          averageAttendeesPerEvent: Math.round(averageAttendees * 100) / 100,
        };
      };

      const virtualMetrics = calculateMetrics(virtualEvents);
      const inPersonMetrics = calculateMetrics(inPersonEvents);

      res.json({
        comparison: {
          virtual: virtualMetrics,
          inPerson: inPersonMetrics,
        },
      });
    } catch (error) {
      console.error('Error in getFormatComparison:', error);
      res.status(500).json({
        error: 'Failed to fetch format comparison',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  };

  return {
    getPopularityMetrics,
    getEngagementMetrics,
    getEventValue,
    getFormatComparison,
  };
};

module.exports = eventPopularityController;
