/* eslint-disable max-lines-per-function */
const mongoose = require('mongoose');
const Seed = require('../../models/kitchenInventory/seed');

const seedController = function () {
  // GET /seeds
  const getAllSeeds = async (req, res) => {
    try {
      const results = await Seed.find().sort({ createdAt: -1 }).lean();
      res.status(200).json(results);
    } catch (err) {
      res.status(500).json(err);
    }
  };

  // GET /seeds/:id
  const getSeedById = async function (req, res) {
    try {
      const { seedId } = req.params;
      const seed = await Seed.findById(seedId);

      if (!seed) {
        res.status(404).json({
          error: 'Seed not found',
        });
        return;
      }

      res.status(200).json({
        _serverMessage: 'Seed retrieved successfully',
        seed,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve seed',
        details: error.message,
      });
    }
  };

  // POST /seeds
  const createSeed = async (req, res) => {
    try {
      const {
        name,
        collectedDate,
        quantityCollected,
        seedType,
        source,
        storageLocation,
        expiryDate,
        notes,
      } = req.body;

      if (!name || quantityCollected === undefined) {
        res.status(400).json({ error: 'Missing required fields: name and quantity collected' });
        return;
      }

      const newSeed = new Seed({
        name,
        collectedDate: collectedDate || Date.now(),
        quantityCollected,
        seedType,
        source,
        storageLocation,
        expiryDate,
        notes,
      });

      const savedSeed = await newSeed.save();
      res.status(201).json(savedSeed);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  // PUT /seeds/:id
  const updateSeed = async (req, res) => {
    try {
      const { seedId } = req.params;
      const updateData = {
        ...req.body,
        updatedAt: Date.now(),
      };

      const updatedSeed = await Seed.findByIdAndUpdate(seedId, updateData, {
        new: true,
        runValidators: true,
      });

      if (!updatedSeed) {
        return res.status(404).json('Seed Not Found');
      }

      res.status(200).json('Seed Updated Successfully');
    } catch (error) {
      res.status(500).json(error);
    }
  };

  // DELETE /seeds/:id
  const deleteSeed = async (req, res) => {
    try {
      const { seedId } = req.params;
      const deletedSeed = await Seed.findByIdAndDelete(seedId);

      if (!deletedSeed) {
        return res.status(404).json('Seed Not Found');
      }
      res.status(200).json('Seed Deleted Successfully');
    } catch (error) {
      res.status(500).json('Failed To Delete Seed');
    }
  };

  return {
    getAllSeeds,
    getSeedById,
    createSeed,
    updateSeed,
    deleteSeed,
  };
};

module.exports = seedController;
