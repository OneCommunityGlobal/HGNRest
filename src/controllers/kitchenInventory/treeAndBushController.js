/* eslint-disable max-lines-per-function */
const mongoose = require('mongoose');
const TreesAndBushes = require('../../models/kitchenInventory/treeAndBush');

const treesAndBushesController = function () {
  // GET /treesandbushes
  const getAllTreesAndBushes = async (req, res) => {
    try {
      const results = await TreesAndBushes.find().sort({ createdAt: -1 }).lean();
      res.status(200).json(results);
    } catch (err) {
      res.status(500).json(err);
    }
  };

  // GET /treesandbushes/:id
  const getTreeAndBushesById = async function (req, res) {
    try {
      const { treeAndBushesId } = req.params;
      const treeAndBushes = await TreesAndBushes.findById(treeAndBushesId);

      if (!treeAndBushes) {
        res.status(404).json({
          error: 'Tree or bush not found',
        });
        return;
      }

      res.status(200).json({
        _serverMessage: 'Tree or bush retrieved successfully',
        treeAndBushes,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve tree or bush',
        details: error.message,
      });
    }
  };

  // POST /treesandbushes
  const createTreesAndBushes = async (req, res) => {
    try {
      const {
        name,
        location,
        plantedDate,
        age,
        condition,
        treeType,
        species,
        height,
        notes,
        lastMaintenanceDate,
      } = req.body;

      if (!name || !location) {
        res.status(400).json({
          error: 'Missing required fields: name and location are required',
        });
        return;
      }

      const newTreesAndBushes = new TreesAndBushes({
        name,
        location,
        plantedDate,
        age,
        condition: condition || 'Good',
        treeType,
        species,
        height,
        notes,
        lastMaintenanceDate,
      });

      const savedTreesAndBushes = await newTreesAndBushes.save();
      res.status(201).json(savedTreesAndBushes);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  // PUT /treesandbushes/:id
  const updateTreesAndBushes = async (req, res) => {
    try {
      const { treeAndBushesId } = req.params;
      const updateData = {
        ...req.body,
        updatedAt: Date.now(),
      };

      const updatedTreesAndBushes = await TreesAndBushes.findByIdAndUpdate(
        treeAndBushesId,
        updateData,
        {
          new: true,
          runValidators: true,
        },
      );

      if (!updatedTreesAndBushes) {
        return res.status(404).json('Tree or Bush Not Found');
      }

      res.status(200).json('Tree or Bush Updated Successfully');
    } catch (error) {
      res.status(500).json(error);
    }
  };

  // DELETE /treesandbushes/:id
  const deleteTreesAndBushes = async (req, res) => {
    try {
      const { treeAndBushesId } = req.params;
      const deletedTreesAndBushes = await TreesAndBushes.findByIdAndDelete(treeAndBushesId);

      if (!deletedTreesAndBushes) {
        return res.status(404).json('Tree or Bush Not Found');
      }
      res.status(200).json('Tree or Bush Deleted Successfully');
    } catch (error) {
      res.status(500).json('Failed To Delete Tree or Bush');
    }
  };

  return {
    getAllTreesAndBushes,
    getTreeAndBushesById,
    createTreesAndBushes,
    updateTreesAndBushes,
    deleteTreesAndBushes,
  };
};

module.exports = treesAndBushesController;
