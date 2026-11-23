const transplantingController = function (TransplantingEvent) {
  const postEvent = async (req, res) => {
    try {
      const { name, related_to, date, position_from, position_to } = req.body;

      if (!name || !related_to || !date || !position_from || !position_to) {
        return res.status(400).send({
          error: 'Name, related_to, date, position_from, and position_to are required.',
        });
      }

      const validModules = ['Garden', 'Orchard', 'Animals'];
      if (!validModules.includes(related_to)) {
        return res.status(400).send({
          error: `Invalid related_to value. Must be one of: ${validModules.join(', ')}`,
        });
      }

      const event = new TransplantingEvent({
        name,
        related_to,
        date,
        position_from,
        position_to,
      });

      await event.save();
      return res.status(201).send(event);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error creating transplanting event:', err);
      return res.status(500).send({ error: 'Internal Server Error' });
    }
  };

  const getEvents = async (req, res) => {
    try {
      const events = await TransplantingEvent.find().sort({ date: 1 });
      return res.status(200).send(events);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching transplanting events:', err);
      return res.status(500).send({ error: 'Internal Server Error' });
    }
  };

  return {
    postEvent,
    getEvents,
  };
};

module.exports = transplantingController;
