const { participants, events, attendance } = require('./AttendanceMockData.jsx');

const noShowVizController = function () {
  // Async function to get no-shows data
  const getNoShowsData = async (req, res) => {
    const { period } = req.query; // Get period from request query

    try {
      const groupedData = {};
      const eventMap = Object.fromEntries(events.map((event) => [event.eventID, event.eventType]));
      const allEventTypes = [...new Set(events.map((event) => event.eventType))];

      attendance.forEach((record) => {
        const eventType = eventMap[record.eventID];
        const eventDate = events.find((event) => event.eventID === record.eventID)?.date;
        const parsedDate = new Date(eventDate);

        // Format date using JavaScript's native Date functions
        const formattedDate =
          period === 'year'
            ? parsedDate.getFullYear().toString()
            : `${parsedDate.toLocaleString('en-US', { year: 'numeric', month: 'short' })}`;

        if (!groupedData[formattedDate]) {
          groupedData[formattedDate] = {};
        }

        if (!groupedData[formattedDate][eventType]) {
          groupedData[formattedDate][eventType] = { attended: 0, notAttended: 0 };
        }

        if (record.attended) {
          groupedData[formattedDate][eventType].attended += 1;
        } else {
          groupedData[formattedDate][eventType].notAttended += 1;
        }
      });

      const result = Object.keys(groupedData)
        .sort((a, b) => {
          const dateA = period === 'year' ? new Date(a) : new Date(Date.parse(a));
          const dateB = period === 'year' ? new Date(b) : new Date(Date.parse(b));
          return dateA - dateB;
        })
        .map((date) => {
          const entry = { date };

          allEventTypes.forEach((event) => {
            entry[event] = groupedData[date][event] || { attended: 0, notAttended: 0 };
          });

          return entry;
        });

      res.status(200).json(result); // Send the result as a JSON response
    } catch (error) {
      console.error('Error fetching no-shows data:', error);
      res.status(500).json({ message: 'Error fetching no-shows data', error });
    }
  };

  // Async function to get no-shows by location
  const getNoShowsByLocation = async (req, res) => {
    try {
      const groupedData = {};
      const eventTypes = [...new Set(events.map((event) => event.eventType))];

      attendance.forEach((record) => {
        const participant = participants.find((p) => p.participantID === record.participantID);
        const event = events.find((e) => e.eventID === record.eventID);

        if (participant && event) {
          const { location } = event;
          const { eventType } = event;

          if (!groupedData[location]) {
            groupedData[location] = {};
          }

          if (!groupedData[location][eventType]) {
            groupedData[location][eventType] = 0;
          }

          if (!record.attended) {
            groupedData[location][eventType] += 1;
          }
        }
      });

      Object.keys(groupedData).forEach((location) => {
        eventTypes.forEach((eventType) => {
          if (!groupedData[location][eventType]) {
            groupedData[location][eventType] = 0;
          }
        });
      });

      const result = Object.keys(groupedData).map((location) => ({
        location,
        ...groupedData[location],
      }));

      res.status(200).json(result); // Send the result as a JSON response
    } catch (error) {
      console.error('Error fetching no-shows by location:', error);
      res.status(500).json({ message: 'Error fetching no-shows by location', error });
    }
  };

  // Async function to get no-shows by age group
  const getNoShowsByAgeGroup = async (req, res) => {
    try {
      const ageGroups = {
        '0-18': [0, 18],
        '19-30': [19, 30],
        '31-40': [31, 40],
        '41-50': [41, 50],
        '51-60': [51, 60],
        '60+': [61, 100],
      };

      const groupedData = {};
      const genderTypes = new Set();

      attendance.forEach((item) => {
        const participant = participants.find((p) => p.participantID === item.participantID);
        if (participant && !item.attended) {
          const ageGroup = Object.keys(ageGroups).find((group) => {
            const [min, max] = ageGroups[group];
            return participant.age >= min && participant.age <= max;
          });

          genderTypes.add(participant.gender);

          if (!groupedData[ageGroup]) {
            groupedData[ageGroup] = {};
          }

          if (!groupedData[ageGroup][participant.gender]) {
            groupedData[ageGroup][participant.gender] = 0;
          }

          groupedData[ageGroup][participant.gender] += 1;
        }
      });

      const resultData = Object.keys(ageGroups).map((ageGroup) => {
        const groupData = groupedData[ageGroup] || {};
        const result = { ageGroup };

        [...genderTypes].forEach((gender) => {
          result[gender] = groupData[gender] || 0;
        });

        return result;
      });

      res.status(200).json({ ageGroupData: resultData, genderTypes: Array.from(genderTypes) });
    } catch (error) {
      console.error('Error fetching no-shows by age group:', error);
      res.status(500).json({ message: 'Error fetching no-shows by age group', error });
    }
  };

  // Async function to get no-show proportions
  const getNoShowProportions = async (req, res) => {
    try {
      const genderCounts = {};

      attendance.forEach((item) => {
        const participant = participants.find((p) => p.participantID === item.participantID);

        if (participant && !item.attended) {
          genderCounts[participant.gender] = (genderCounts[participant.gender] || 0) + 1;
        }
      });

      const result = Object.keys(genderCounts).map((gender) => ({
        name: gender,
        value: genderCounts[gender],
      }));

      res.status(200).json(result); // Send the result as a JSON response
    } catch (error) {
      console.error('Error fetching no-show proportions:', error);
      res.status(500).json({ message: 'Error fetching no-show proportions', error });
    }
  };

  // Async function to get unique event types
  const getUniqueEventTypes = async (req, res) => {
    try {
      const eventTypes = new Set(events.map((event) => event.eventType));
      const result = [...Array.from(eventTypes)];

      res.status(200).json(result); // Send the result as a JSON response
    } catch (error) {
      console.error('Error fetching unique event types:', error);
      res.status(500).json({ message: 'Error fetching unique event types', error });
    }
  };

  // Async function to get attendance by day, based on event type
  const getAttendanceByDay = async (req, res) => {
    const { selectedEventType } = req.query; // Get selected event type from request query

    try {
      const groupedData = {
        Sunday: 0,
        Monday: 0,
        Tuesday: 0,
        Wednesday: 0,
        Thursday: 0,
        Friday: 0,
        Saturday: 0,
      };

      attendance.forEach((item) => {
        const event = events.find((e) => e.eventID === item.eventID);

        if (
          event &&
          item.attended &&
          (selectedEventType === 'All' || event.eventType === selectedEventType)
        ) {
          const day = new Date(event.date).toLocaleString('en-US', { weekday: 'long' });
          groupedData[day] += 1;
        }
      });

      const result = Object.keys(groupedData).map((day) => ({
        day,
        attended: groupedData[day],
      }));

      res.status(200).json(result); // Send the result as a JSON response
    } catch (error) {
      console.error('Error fetching attendance by day:', error);
      res.status(500).json({ message: 'Error fetching attendance by day', error });
    }
  };

  return {
    getNoShowsData,
    getNoShowsByLocation,
    getNoShowsByAgeGroup,
    getAttendanceByDay,
    getUniqueEventTypes,
    getNoShowProportions,
  };
};

module.exports = noShowVizController;
