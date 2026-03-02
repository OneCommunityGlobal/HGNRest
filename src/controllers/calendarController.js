const calendarController = function (CalendarEvent, ProcessingProject) {
  const getCalendarEvents = async (req, res) => {
    try {
      const { month, year, module: moduleFilter } = req.query;

      if (!month || !year) {
        return res.status(400).send({ error: 'Month and year query parameters are required.' });
      }

      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);

      if (Number.isNaN(monthNum) || Number.isNaN(yearNum) || monthNum < 1 || monthNum > 12) {
        return res.status(400).send({ error: 'Invalid month or year value.' });
      }

      // Build date range: start of month to end of month
      const startDate = new Date(yearNum, monthNum - 1, 1);
      const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);

      const dateFilter = {
        scheduled_date: { $gte: startDate, $lte: endDate },
      };

      const validModules = ['garden', 'orchard', 'animals', 'kitchen'];

      if (moduleFilter && !validModules.includes(moduleFilter)) {
        return res.status(400).send({
          error: `Invalid module. Must be one of: ${validModules.join(', ')}`,
        });
      }

      let events = [];

      if (moduleFilter === 'kitchen') {
        // Query kitchen events from ProcessingProject collection
        const kitchenProjects = await ProcessingProject.find(dateFilter).sort({
          scheduled_date: 1,
        });
        events = kitchenProjects.map((project) => ({
          _id: project._id,
          title: project.item_name,
          module: 'kitchen',
          event_type: project.process_name,
          scheduled_date: project.scheduled_date,
          description: '',
          assigned_to: '',
          related_item: project.item_name,
          status: 'scheduled',
        }));
      } else if (moduleFilter) {
        // Query a specific non-kitchen module
        events = await CalendarEvent.find({ ...dateFilter, module: moduleFilter }).sort({
          scheduled_date: 1,
        });
      } else {
        // No filter: query all modules in parallel
        const [calendarEvents, kitchenProjects] = await Promise.all([
          CalendarEvent.find(dateFilter).sort({ scheduled_date: 1 }),
          ProcessingProject.find(dateFilter).sort({ scheduled_date: 1 }),
        ]);

        const normalizedKitchen = kitchenProjects.map((project) => ({
          _id: project._id,
          title: project.item_name,
          module: 'kitchen',
          event_type: project.process_name,
          scheduled_date: project.scheduled_date,
          description: '',
          assigned_to: '',
          related_item: project.item_name,
          status: 'scheduled',
        }));

        events = [...calendarEvents, ...normalizedKitchen];

        // Sort merged results by scheduled_date
        events.sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));
      }

      return res.status(200).send({ events });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error fetching calendar events:', err);
      return res.status(500).send({ error: 'Internal Server Error' });
    }
  };

  const createEvent = async (req, res) => {
    try {
      const {
        title,
        module: eventModule,
        event_type,
        scheduled_date,
        description,
        assigned_to,
        related_item,
        status,
      } = req.body;

      if (!title || !eventModule || !event_type || !scheduled_date) {
        return res.status(400).send({
          error: 'Title, module, event_type, and scheduled_date are required.',
        });
      }

      const validModules = ['garden', 'orchard', 'animals', 'kitchen'];
      if (!validModules.includes(eventModule)) {
        return res.status(400).send({
          error: `Invalid module. Must be one of: ${validModules.join(', ')}`,
        });
      }

      const event = new CalendarEvent({
        title,
        module: eventModule,
        event_type,
        scheduled_date,
        description,
        assigned_to,
        related_item,
        status,
      });

      await event.save();
      return res.status(201).send(event);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error creating calendar event:', err);
      return res.status(500).send({ error: 'Internal Server Error' });
    }
  };

  const deleteEvent = async (req, res) => {
    try {
      const { id } = req.params;

      const event = await CalendarEvent.findById(id);
      if (!event) {
        return res.status(404).send({ error: 'Event not found.' });
      }

      await CalendarEvent.findByIdAndDelete(id);
      return res.status(200).send({ message: 'Event successfully deleted.' });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error deleting calendar event:', err);
      return res.status(500).send({ error: 'Internal Server Error' });
    }
  };

  return {
    getCalendarEvents,
    createEvent,
    deleteEvent,
  };
};

module.exports = calendarController;
