const plantingController = function (PlantingEvent) {
  const postEvent = async (req, res) => {
    try {
      const { name, related_to, count, date, location } = req.body;

      if (!name || !related_to || !count || !date || !location) {
        return res.status(400).send({
          error: 'Name, related_to, count, date, and location are required.',
        });
      }

      const validModules = ['Garden', 'Orchard', 'Animals'];
      if (!validModules.includes(related_to)) {
        return res.status(400).send({
          error: `Invalid related_to value. Must be one of: ${validModules.join(', ')}`,
        });
      }

      const event = new PlantingEvent({
        name,
        related_to,
        count,
        date,
        location,
      });

      await event.save();
      return res.status(201).send(event);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error creating planting event:', err);
      return res.status(500).send({ error: 'Internal Server Error' });
    }
  };

  const getEvents = async (req, res) => {
    try {
      const events = await PlantingEvent.find().sort({ date: 1 });
      return res.status(200).send(events);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching planting events:', err);
      return res.status(500).send({ error: 'Internal Server Error' });
    }
  };

  return {
    postEvent,
    getEvents,
  };
};

module.exports = plantingController;
