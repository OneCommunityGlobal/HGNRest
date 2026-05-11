const mongoose = require('mongoose');

const processingProjectController = function (ProcessingProject) {
  const postProject = async (req, res) => {
    try {
      const {
        item_name,
        process_name,
        quantity,
        unit,
        batches,
        supplies_quantity,
        supplies_type,
        scheduled_date,
        priority,
      } = req.body;

      if (!item_name || !process_name || !quantity) {
        return res
          .status(400)
          .send({ error: 'Item name, process name, and quantity are required.' });
      }

      const project = new ProcessingProject({
        item_name,
        process_name,
        quantity,
        unit,
        batches,
        supplies_quantity,
        supplies_type,
        scheduled_date,
        priority,
      });

      await project.save();
      res.status(201).send(project);
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Internal Server Error' });
    }
  };

  const getProjects = async (req, res) => {
    try {
      // Get all projects, sorted by scheduled_date ascending (upcoming first)
      // If user wants "current and upcoming", we technically might want to filter scheduled_date >= today
      // But based on the request "get all the current and upcoming projects", returning all sorted is a good start.
      const projects = await ProcessingProject.find().sort({ scheduled_date: 1 });

      res.status(200).send(projects);
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: 'Internal Server Error' });
    }
  };

  return {
    postProject,
    getProjects,
  };
};

module.exports = processingProjectController;
