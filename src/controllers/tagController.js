const mongoose = require('mongoose');
const Tag = require('../models/tag');
const Project = require('../models/project');
const cache = require('../utilities/nodeCache')();
const logger = require('../startup/logger');

const tagController = function () {
  /**
   * Get most frequently used tags with optional filtering
   */
  const getFrequentTags = async function (req, res) {
    try {
      const { projectId, startDate, endDate, limit = 20 } = req.query;
      
      // Validate the limit parameter
      const limitNumber = Math.max(1, Math.min(100, parseInt(limit, 10)));
      
      // Create cache key based on query parameters
      const cacheKey = `frequent_tags:${projectId || 'all'}:${startDate || ''}:${endDate || ''}:${limitNumber}`;
      
      // Try to get data from cache first
      if (cache.hasCache(cacheKey)) {
        return res.status(200).json(cache.getCache(cacheKey));
      }
      
      // Build query for MongoDB
      const query = {};
      
      if (projectId) {
        query.projectId = projectId;
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
      const tags = await Tag.aggregate([
        { $match: query },
        { $group: {
            _id: "$tagName",
            frequency: { $sum: "$frequency" }
          }
        },
        { $project: {
            _id: 0,
            tag: "$_id",
            frequency: 1
          }
        },
        { $sort: { frequency: -1 } },
        { $limit: limitNumber }
      ]);
      
      const response = {
        data: tags
      };
      
      // Store in cache
      cache.setCache(cacheKey, response);
      
      return res.status(200).json(response);
    } catch (error) {
      logger.logException(error);
      return res.status(500).json({ 
        error: 'Failed to fetch frequent tags', 
        details: error.message 
      });
    }
  };

  /**
   * Get tags by project with pagination
   */
  const getTagsByProject = async function (req, res) {
    try {
      const { projectId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      // Validate pagination parameters
      const pageNumber = Math.max(1, parseInt(page, 10));
      const limitNumber = Math.max(1, Math.min(100, parseInt(limit, 10)));

      // Create cache key
      const cacheKey = `tags_project:${projectId}:${pageNumber}:${limitNumber}`;
      
      // Check cache first
      if (cache.hasCache(cacheKey)) {
        return res.status(200).json(cache.getCache(cacheKey));
      }

      // Verify project exists
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(400).json({ error: 'Invalid project' });
      }

      // Find tags for the specified project
      const query = { projectId };
      
      // Get total count for pagination
      const totalTags = await Tag.countDocuments(query);
      
      // Fetch paginated results
      const tags = await Tag.find(query)
        .sort({ frequency: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber);

      const response = {
        tags,
        pagination: {
          totalTags,
          totalPages: Math.ceil(totalTags / limitNumber),
          currentPage: pageNumber,
          limit: limitNumber,
          hasNextPage: pageNumber < Math.ceil(totalTags / limitNumber),
          hasPreviousPage: pageNumber > 1,
        },
      };
      
      // Cache the response
      cache.setCache(cacheKey, response);

      res.status(200).json(response);
    } catch (error) {
      logger.logException(error);
      res.status(500).json({ 
        error: 'Failed to fetch tags for project', 
        details: error.message 
      });
    }
  };

  /**
   * Create or update a tag
   */
  const upsertTag = async function (req, res) {
    try {
      const { tagName, projectId } = req.body;

      if (!tagName || !projectId) {
        return res.status(400).json({ error: 'Tag name and project ID are required' });
      }

      // Verify project exists
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(400).json({ error: 'Invalid project' });
      }

      // Find and update or create if not exists
      const now = new Date();
      const result = await Tag.findOneAndUpdate(
        { tagName, projectId },
        { 
          $inc: { frequency: 1 },
          $setOnInsert: { createdAt: now }
        },
        { new: true, upsert: true }
      );

      // Invalidate related cache entries
      cache.removeCache(`frequent_tags:${projectId}*`);
      cache.removeCache(`frequent_tags:all*`);
      cache.removeCache(`tags_project:${projectId}*`);
      cache.removeCache(`tag_suggestions:*${projectId}*`);

      res.status(200).json(result);
    } catch (error) {
      logger.logException(error);
      res.status(500).json({ 
        error: 'Failed to create or update tag', 
        details: error.message 
      });
    }
  };

  /**
   * Get tag suggestions (for autocomplete)
   */
  const getTagSuggestions = async function (req, res) {
    try {
      const { query = '', projectId } = req.query;

      // Create cache key
      const cacheKey = `tag_suggestions:${query}:${projectId || 'all'}`;
      
      // Check cache first
      if (cache.hasCache(cacheKey)) {
        return res.status(200).json(cache.getCache(cacheKey));
      }

      const queryObj = { 
        tagName: { $regex: query, $options: 'i' }
      };
      
      if (projectId) {
        queryObj.projectId = projectId;
      }

      const suggestions = await Tag.find(queryObj)
        .distinct('tagName')
        .limit(10);

      const response = { suggestions };
      
      // Cache the response with a shorter TTL for suggestions
      cache.setCache(cacheKey, response);
      cache.setKeyTimeToLive(cacheKey, 300); // 5 minutes TTL for suggestions

      res.status(200).json(response);
    } catch (error) {
      logger.logException(error);
      res.status(500).json({ 
        error: 'Failed to fetch tag suggestions', 
        details: error.message 
      });
    }
  };

  /**
   * Get tag by ID
   */
  const getTagById = async function (req, res) {
    try {
      const { tagId } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(tagId)) {
        return res.status(400).json({ error: 'Invalid tag ID format' });
      }

      const tag = await Tag.findById(tagId);
      
      if (!tag) {
        return res.status(404).json({ error: 'Tag not found' });
      }
      
      res.status(200).json(tag);
    } catch (error) {
      logger.logException(error);
      res.status(500).json({ 
        error: 'Failed to fetch tag', 
        details: error.message 
      });
    }
  };

  /**
   * Delete a tag
   */
  const deleteTag = async function (req, res) {
    try {
      const { tagId } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(tagId)) {
        return res.status(400).json({ error: 'Invalid tag ID format' });
      }

      const tag = await Tag.findById(tagId);
      
      if (!tag) {
        return res.status(404).json({ error: 'Tag not found' });
      }
      
      // Delete the tag
      await tag.remove();
      
      // Invalidate caches
      cache.removeCache(`frequent_tags:${tag.projectId}*`);
      cache.removeCache(`frequent_tags:all*`);
      cache.removeCache(`tags_project:${tag.projectId}*`);
      cache.removeCache(`tag_suggestions:*${tag.projectId}*`);
      
      res.status(200).json({ message: 'Tag deleted successfully' });
    } catch (error) {
      logger.logException(error);
      res.status(500).json({ 
        error: 'Failed to delete tag', 
        details: error.message 
      });
    }
  };

  return {
    getFrequentTags,
    getTagsByProject,
    upsertTag,
    getTagSuggestions,
    getTagById,
    deleteTag
  };
};

module.exports = tagController;