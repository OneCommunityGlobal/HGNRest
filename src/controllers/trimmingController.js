const trimmingController = function (TrimmingEvent) {
  const postEvent = async (req, res) => {
    try {
      const { name, related_to, pruning_type, last_trim_date, next_trim_date } = req.body;

      if (!name || !related_to || !pruning_type || !last_trim_date || !next_trim_date) {
        return res.status(400).send({
          error: 'Name, related_to, pruning_type, last_trim_date, and next_trim_date are required.',
        });
      }

      const validModules = ['Garden', 'Orchard', 'Animals'];
      if (!validModules.includes(related_to)) {
        return res.status(400).send({
          error: `Invalid related_to value. Must be one of: ${validModules.join(', ')}`,
        });
      }

      const event = new TrimmingEvent({
        name,
        related_to,
        pruning_type,
        last_trim_date,
        next_trim_date,
      });

      await event.save();
      return res.status(201).send(event);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error creating trimming event:', err);
      return res.status(500).send({ error: 'Internal Server Error' });
    }
  };

  const getEvents = async (req, res) => {
    try {
      const events = await TrimmingEvent.find().sort({ next_trim_date: 1 });
      return res.status(200).send(events);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching trimming events:', err);
      return res.status(500).send({ error: 'Internal Server Error' });
    }
  };

  return {
    postEvent,
    getEvents,
  };
};

module.exports = trimmingController;
