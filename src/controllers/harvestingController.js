const harvestingController = function (HarvestingEvent) {
  const postEvent = async (req, res) => {
    try {
      const { name, related_to, type, expected_date, yield: yieldAmount } = req.body;

      if (!name || !related_to || !type || !expected_date) {
        return res.status(400).send({
          error: 'Name, related_to, type, and expected_date are required.',
        });
      }

      const validModules = ['Garden', 'Orchard', 'Animals'];
      if (!validModules.includes(related_to)) {
        return res.status(400).send({
          error: `Invalid related_to value. Must be one of: ${validModules.join(', ')}`,
        });
      }

      const validTypes = ['garden harvesting', 'orchard harvesting'];
      if (!validTypes.includes(type)) {
        return res.status(400).send({
          error: `Invalid type value. Must be one of: ${validTypes.join(', ')}`,
        });
      }

      const event = new HarvestingEvent({
        name,
        related_to,
        type,
        expected_date,
        yield: yieldAmount,
      });

      await event.save();
      return res.status(201).send(event);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error creating harvesting event:', err);
      return res.status(500).send({ error: 'Internal Server Error' });
    }
  };

  const getEvents = async (req, res) => {
    try {
      const { type } = req.query;

      const filter = {};
      if (type) {
        const validTypes = ['garden harvesting', 'orchard harvesting'];
        if (!validTypes.includes(type)) {
          return res.status(400).send({
            error: `Invalid type filter. Must be one of: ${validTypes.join(', ')}`,
          });
        }
        filter.type = type;
      }

      const events = await HarvestingEvent.find(filter).sort({ expected_date: 1 });
      return res.status(200).send(events);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching harvesting events:', err);
      return res.status(500).send({ error: 'Internal Server Error' });
    }
  };

  return {
    postEvent,
    getEvents,
  };
};

module.exports = harvestingController;
