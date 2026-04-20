const mongoose = require('mongoose');
const Form = require('../models/resourceManagementModel');

// get all forms
const getForms = async (req, res) => {
  const forms = await Form.find({}).sort({ createdAt: -1 });

  res.status(200).json(forms);
};

// get a single form
const getForm = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ error: 'No such form' });
  }

  const form = await Form.findById(id);

  if (!form) {
    return res.status(404).json({ error: 'No such form' });
  }

  res.status(200).json(form);
};

// create a new form
const createForm = async (req, res) => {
  const { user, duration, facilities, materials, date } = req.body;

  // add to the database
  try {
    const form = await Form.create({ user, duration, facilities, materials, date });
    console.log('Successfully made a new form');
    res.status(200).json(form);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// delete a form
const deleteForm = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ error: 'No such form' });
  }

  const form = await Form.findOneAndDelete({ _id: id });

  if (!form) {
    return res.status(400).json({ error: 'No such form' });
  }

  res.status(200).json(form);
};

// update a form
const updateForm = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ error: 'No such form' });
  }

  const form = await Form.findOneAndUpdate(
    { _id: id },
    {
      ...req.body,
    },
  );

  if (!form) {
    return res.status(400).json({ error: 'No such form' });
  }

  res.status(200).json(form);
};

module.exports = {
  getForms,
  getForm,
  createForm,
  deleteForm,
  updateForm,
};
