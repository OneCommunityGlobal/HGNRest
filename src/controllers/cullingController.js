const cullingController = function (CullingEvent) {
  const postEvent = async (req, res) => {
    try {
      const { name, related_to, count, purpose, notes, scheduled_date } = req.body;

      if (!name || !related_to || !count || !purpose || !scheduled_date) {
        return res.status(400).send({
          error: 'Name, related_to, count, purpose, and scheduled_date are required.',
        });
      }

      const validModules = ['Garden', 'Orchard', 'Animals'];
      if (!validModules.includes(related_to)) {
        return res.status(400).send({
          error: `Invalid related_to value. Must be one of: ${validModules.join(', ')}`,
        });
      }

      const event = new CullingEvent({
        name,
        related_to,
        count,
        purpose,
        notes,
        scheduled_date,
      });

      await event.save();
      return res.status(201).send(event);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error creating culling event:', err);
      return res.status(500).send({ error: 'Internal Server Error' });
    }
  };

  const getEvents = async (req, res) => {
    try {
      const events = await CullingEvent.find().sort({ scheduled_date: 1 });
      return res.status(200).send(events);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching culling events:', err);
      return res.status(500).send({ error: 'Internal Server Error' });
    }
  };

  return {
    postEvent,
    getEvents,
  };
};

module.exports = cullingController;
