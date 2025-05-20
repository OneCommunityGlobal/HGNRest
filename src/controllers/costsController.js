const mongoose = require('mongoose');
const Cost = require('../models/costs');
const Project = require('../models/project');
const cache = require('../utilities/nodeCache')();
const logger = require('../startup/logger');

const costsController = function () {
  /**
   * Add new cost entry
   */
  const addCostEntry = async function (req, res) {
    try {
      const { category, amount, projectId } = req.body;
  
      if (!category || !amount || !projectId) {
        return res.status(400).json({ 
          error: 'Category, amount, and project ID are all required' 
        });
      }
      
      if (Number.isNaN(Number(amount)) || amount <= 0) {
        return res.status(400).json({ 
          error: 'Amount must be a positive number' 
        });
      }
  
      // Verify project exists
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(400).json({ error: 'Invalid project' });
      }
  
      // Create new cost entry
      const newCost = new Cost({
        category,
        amount,
        projectId,
        createdAt: new Date()
      });
      
      await newCost.save();
  
      // Invalidate related cache entries
      cache.removeCache(`cost_breakdown:${projectId}*`);
      cache.removeCache(`cost_breakdown:all*`);
  
      res.status(201).json(newCost);
    } catch (error) {
      logger.logException(error);
      res.status(500).json({ 
        error: 'Failed to add cost entry', 
        details: error.message 
      });
    }
  };

  /**
   * Update cost entry
   */
  const updateCostEntry = async function (req, res) {
    try {
      const { costId } = req.params;
      const { category, amount } = req.body;
      
      if (!mongoose.Types.ObjectId.isValid(costId)) {
        return res.status(400).json({ error: 'Invalid cost ID format' });
      }
      
      if (amount !== undefined && (Number.isNaN(Number(amount)) || amount <= 0)) {
        return res.status(400).json({ 
          error: 'Amount must be a positive number' 
        });
      }
      
      // Find cost entry
      const cost = await Cost.findById(costId);
      
      if (!cost) {
        return res.status(404).json({ error: 'Cost entry not found' });
      }
      
      // Update fields if provided
      if (category) cost.category = category;
      if (amount) cost.amount = amount;
      
      await cost.save();
      
      // Invalidate related cache entries
      cache.removeCache(`cost_breakdown:${cost.projectId}*`);
      cache.removeCache(`cost_breakdown:all*`);
      
      res.status(200).json(cost);
    } catch (error) {
      logger.logException(error);
      res.status(500).json({ 
        error: 'Failed to update cost entry', 
        details: error.message 
      });
    }
  };

  /**
   * Delete cost entry
   */
  const deleteCostEntry = async function (req, res) {
    try {
      const { costId } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(costId)) {
        return res.status(400).json({ error: 'Invalid cost ID format' });
      }

      const cost = await Cost.findById(costId);
      
      if (!cost) {
        return res.status(404).json({ error: 'Cost entry not found' });
      }
      
      const {projectId} = cost;
      
      // Delete the cost entry
      await Cost.deleteOne({ _id: costId });
      
      // Invalidate caches
      cache.removeCache(`cost_breakdown:${projectId}*`);
      cache.removeCache(`cost_breakdown:all*`);
      
      res.status(200).json({ message: 'Cost entry deleted successfully' });
    } catch (error) {
      logger.logException(error);
      res.status(500).json({ 
        error: 'Failed to delete cost entry', 
        details: error.message 
      });
    }
  };

  /**
   * Get cost entries by project with pagination
   */
  const getCostsByProject = async function (req, res) {
    try {
      const { projectId } = req.params;
      const { page = 1, limit = 20, category } = req.query;

      // Validate pagination parameters
      const pageNumber = Math.max(1, parseInt(page, 10));
      const limitNumber = Math.max(1, Math.min(100, parseInt(limit, 10)));

      // Create cache key
      const cacheKey = `costs_project:${projectId}:${category || 'all'}:${pageNumber}:${limitNumber}`;
      
      // Check cache first
      if (cache.hasCache(cacheKey)) {
        return res.status(200).json(cache.getCache(cacheKey));
      }

      // Verify project exists
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(400).json({ error: 'Invalid project' });
      }

      // Build query
      const query = { projectId };
      if (category) {
        query.category = category;
      }
      
      // Get total count for pagination
      const totalCosts = await Cost.countDocuments(query);
      
      // Fetch paginated results
      const costs = await Cost.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber);

      const response = {
        costs,
        pagination: {
          totalCosts,
          totalPages: Math.ceil(totalCosts / limitNumber),
          currentPage: pageNumber,
          limit: limitNumber,
          hasNextPage: pageNumber < Math.ceil(totalCosts / limitNumber),
          hasPreviousPage: pageNumber > 1,
        },
      };
      
      // Cache the response
      cache.setCache(cacheKey, response);

      res.status(200).json(response);
    } catch (error) {
      logger.logException(error);
      res.status(500).json({ 
        error: 'Failed to fetch costs for project', 
        details: error.message 
      });
    }
  };

  /**
   * Get cost breakdown data with optional filtering
   */
  const getCostBreakdown = async function (req, res) {
    try {
      const { projectId, startDate, endDate } = req.query;
      
      // Create cache key based on query parameters
      const cacheKey = `cost_breakdown:${projectId || 'all'}:${startDate || ''}:${endDate || ''}`;
      
      // Try to get data from cache first
      if (cache.hasCache(cacheKey)) {
        return res.status(200).json(cache.getCache(cacheKey));
      }
      
      // Build query for MongoDB
      const query = {};
      
      if (projectId) {
        query.projectId = projectId;
        
        // Verify project exists if projectId is provided
        const project = await Project.findById(projectId);
        if (!project) {
          return res.status(400).json({ error: 'Invalid project' });
        }
      }
      
      if (startDate || endDate) {
        query.createdAt = {};
        
        if (startDate) {
          query.createdAt.$gte = new Date(startDate);
        }
        
        if (endDate) {
          query.createdAt.$lte = new Date(endDate);
        }
      }
      
      // Fetch data with aggregation pipeline
      const costBreakdown = await Cost.aggregate([
        { $match: query },
        { $group: {
            _id: "$category",
            amount: { $sum: "$amount" }
          }
        },
        { $project: {
            _id: 0,
            category: "$_id",
            amount: 1
          }
        },
        { $sort: { amount: -1 } }
      ]);
      
      // Calculate total cost
      const totalCost = costBreakdown.reduce((sum, item) => sum + item.amount, 0);
      
      // Get project name if projectId provided
      let projectName = "All Projects";
      if (projectId) {
        const project = await Project.findById(projectId);
        if (project) {
          projectName = project.name;
        }
      }
      
      const response = {
        project: projectName,
        totalCost,
        breakdown: costBreakdown
      };
      
      // Store in cache
      cache.setCache(cacheKey, response);
      
      return res.status(200).json(response);
    } catch (error) {
      logger.logException(error);
      return res.status(500).json({ 
        error: 'Failed to fetch cost breakdown', 
        details: error.message 
      });
    }
  };

  return {
    getCostBreakdown,
    addCostEntry,
    updateCostEntry,
    deleteCostEntry,
    getCostsByProject
  };
};

module.exports = costsController;