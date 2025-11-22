const { events, attendance } = require('./AttendanceMockData');

const eventsController = function () {
  const getEvents = async function (req, res) {
    try {
      const dynamicEvents = events.map((event) => {
        const registeredCount = attendance.filter(
          (record) => record.eventID === event.eventID,
        ).length;

        let status = 'Open';
        const capacity = event.maxAttendees || 100;
        const percentage = registeredCount / capacity;

        if (registeredCount >= capacity) {
          status = 'Full';
        } else if (percentage >= 0.8) {
          status = 'Filling Fast';
        } else if (registeredCount === 0) {
          status = 'New';
        } else {
          status = 'Needs Attendees';
        }

        return {
          id: event.eventID,
          title: event.eventName,
          type: event.eventType,
          location: event.location,
          time: event.time || '10:00 AM',
          date: event.date,
          status,
          description: event.description || 'No description provided',
          capacity,
          registered: registeredCount,
        };
      });

      res.status(200).json(dynamicEvents);
    } catch (err) {
      console.error('Controller Error:', err);
      res.status(500).json({ error: `Failed to fetch events: ${err.message}` });
    }
  };

  return { getEvents };
};

module.exports = eventsController;
