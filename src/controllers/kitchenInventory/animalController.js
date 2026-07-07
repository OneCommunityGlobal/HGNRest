/* eslint-disable max-lines-per-function */
const mongoose = require('mongoose');
const Animal = require('../../models/kitchenInventory/animal');

const animalController = function () {
  // GET /animals
  const getAllAnimals = async (req, res) => {
    try {
      const results = await Animal.find().sort({ createdAt: -1 }).lean();
      res.status(200).json(results);
    } catch (err) {
      res.status(500).json(err);
    }
  };

  // GET /animals/:id
  const getAnimalById = async function (req, res) {
    try {
      const { animalId } = req.params;
      const animal = await Animal.findById(animalId);

      if (!animal) {
        res.status(404).json({
          error: 'Animal not found',
        });
        return;
      }

      res.status(200).json({
        _serverMessage: 'Animal retrieved successfully',
        animal,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve animal',
        details: error.message,
      });
    }
  };

  // POST /animals
  const createAnimal = async (req, res) => {
    try {
      const {
        name,
        breed,
        count,
        purpose,
        location,
        health,
        acquiredDate,
        species,
        notes,
        vaccinations,
      } = req.body;

      if (!name || !count || !location) {
        res.status(400).json({
          error: 'Missing required fields: name, count, and location are required',
        });
        return;
      }

      if (count <= 0) {
        res.status(400).json({
          error: 'Count must be greater than 0',
        });
        return;
      }

      const newAnimal = new Animal({
        name,
        breed,
        count,
        purpose,
        location,
        health: health || 'Healthy',
        acquiredDate,
        species,
        notes,
        vaccinations,
      });

      const savedAnimal = await newAnimal.save();
      res.status(201).json(savedAnimal);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  // PUT /animals/:id
  const updateAnimal = async (req, res) => {
    try {
      const { animalId } = req.params;
      const updateData = {
        ...req.body,
        updatedAt: Date.now(),
      };

      const updatedAnimal = await Animal.findByIdAndUpdate(animalId, updateData, {
        new: true,
        runValidators: true,
      });

      if (!updatedAnimal) {
        return res.status(404).json('Animal Not Found');
      }

      res.status(200).json('Animal Updated Successfully');
    } catch (error) {
      res.status(500).json(error);
    }
  };

  // DELETE /animals/:id
  const deleteAnimal = async (req, res) => {
    try {
      const { animalId } = req.params;
      const deletedAnimal = await Animal.findByIdAndDelete(animalId);

      if (!deletedAnimal) {
        return res.status(404).json('Animal Not Found');
      }
      res.status(200).json('Animal Deleted Successfully');
    } catch (error) {
      res.status(500).json('Failed To Delete Animal');
    }
  };

  return {
    getAllAnimals,
    getAnimalById,
    createAnimal,
    updateAnimal,
    deleteAnimal,
  };
};

module.exports = animalController;
