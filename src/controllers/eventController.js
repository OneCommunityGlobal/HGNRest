// const events = [];

// const eventController = {
//   registerEvent: (req, res) => {
//     const { eventName } = req.body;

//     if (!eventName || eventName.trim() === '') {
//       return res.status(400).json({ error: 'Event Name is required.' });
//     }

//     const newEvent = {
//       id: events.length + 1,
//       name: eventName.trim(),
//       createdAt: new Date()
//     };

//     events.push(newEvent);

//     res.status(201).json({ message: 'Event registered successfully', event: newEvent });
//   },

//   getAllEvents: (req, res) => {
//     res.json(events);
//   }
// };

// module.exports = eventController;

const events = [];

const eventController = {
  registerEvent: (req, res) => {
    console.log("Hello!") //not getting called
    console.log('Received event data:', req.body);  // Log all incoming data
    const { eventName } = req.body;

    if (!eventName || eventName.trim() === '') {
      return res.status(400).json({ error: 'Event Name is required.' });
    }

    const newEvent = {
      id: events.length + 1,
      ...req.body,  // Spread all fields from the request body
      name: eventName.trim(),
      createdAt: new Date()
    };

    events.push(newEvent);

    console.log('New event registered:', newEvent);  // Log the new event
    res.status(201).json({ message: 'Event registered successfully', event: newEvent });
  },

  getAllEvents: (req, res) => {
    res.json(events);
  }
};

module.exports = eventController;