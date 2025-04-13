const mongoose = require("mongoose")
const LaborCost = require("../models/laborCost")
const cache = require("../utilities/nodeCache")()
const logger = require("../startup/logger")

const laborCostController = () => {
  /**
   * Get labor costs with filtering options
   */
  const getLaborCosts = async (req, res) => {
    try {
      const { projects, tasks, start_date, end_date, page = 1, limit = 20 } = req.query

      // Validate pagination parameters
      const pageNumber = Math.max(1, Number.parseInt(page, 10))
      const limitNumber = Math.max(1, Math.min(100, Number.parseInt(limit, 10)))

      // Create cache key based on query parameters
      const projectsKey = projects ? projects.sort().join(",") : "all"
      const tasksKey = tasks ? tasks.sort().join(",") : "all"
      const cacheKey = `labor_costs:${projectsKey}:${tasksKey}:${start_date || ""}:${end_date || ""}:${pageNumber}:${limitNumber}`

      // Try to get data from cache first
      if (cache.hasCache(cacheKey)) {
        return res.status(200).json(cache.getCache(cacheKey))
      }

      // Build query for MongoDB
      const query = {}

      // Filter by projects if provided
      if (projects) {
        const projectList = Array.isArray(projects) ? projects : [projects]
        query.project_name = { $in: projectList }
      }

      // Filter by tasks if provided
      if (tasks) {
        const taskList = Array.isArray(tasks) ? tasks : [tasks]
        query.task = { $in: taskList }
      }

      // Filter by date range if provided
      if (start_date || end_date) {
        query.date = {}

        if (start_date) {
          query.date.$gte = new Date(start_date)
        }

        if (end_date) {
          query.date.$lte = new Date(end_date)
        }
      }

      // Get total count for pagination
      const totalCosts = await LaborCost.countDocuments(query)

      // Fetch paginated results
      const laborCosts = await LaborCost.find(query)
        .sort({ date: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)

      // Prepare response
      const response = {
        laborCosts,
        pagination: {
          totalCosts,
          totalPages: Math.ceil(totalCosts / limitNumber),
          currentPage: pageNumber,
          limit: limitNumber,
          hasNextPage: pageNumber < Math.ceil(totalCosts / limitNumber),
          hasPreviousPage: pageNumber > 1,
        },
      }

      // Cache the response
      cache.setCache(cacheKey, response, 3600) // Cache for 1 hour

      res.status(200).json(response)
    } catch (error) {
      logger.logException(error)
      res.status(500).json({
        error: "Failed to fetch labor costs",
        details: error.message,
      })
    }
  }

  /**
   * Add new labor cost entry
   */
  const addLaborCost = async (req, res) => {
    try {
      const { project_name, task, cost, date } = req.body

      // Validate required fields
      if (!project_name || !task || !cost) {
        return res.status(400).json({
          error: "Project name, task, and cost are all required",
        })
      }

      // Validate cost is a positive number
      if (Number.isNaN(Number(cost)) || cost <= 0) {
        return res.status(400).json({
          error: "Cost must be a positive number",
        })
      }

      // Create new labor cost entry
      const newLaborCost = new LaborCost({
        project_name,
        task,
        cost,
        date: date ? new Date(date) : new Date(),
      })

      await newLaborCost.save()

      // Invalidate related cache entries
      cache.removeCache(`labor_costs:*`)

      res.status(201).json(newLaborCost)
    } catch (error) {
      logger.logException(error)
      res.status(500).json({
        error: "Failed to add labor cost entry",
        details: error.message,
      })
    }
  }

  /**
   * Update labor cost entry
   */
  const updateLaborCost = async (req, res) => {
    try {
      const { laborCostId } = req.params
      const { project_name, task, cost, date } = req.body

      if (!mongoose.Types.ObjectId.isValid(laborCostId)) {
        return res.status(400).json({ error: "Invalid labor cost ID format" })
      }

      // Validate cost if provided
      if (cost !== undefined && (Number.isNaN(Number(cost)) || cost <= 0)) {
        return res.status(400).json({
          error: "Cost must be a positive number",
        })
      }

      // Find labor cost entry
      const laborCost = await LaborCost.findById(laborCostId)

      if (!laborCost) {
        return res.status(404).json({ error: "Labor cost entry not found" })
      }

      // Update fields if provided
      if (project_name) laborCost.project_name = project_name
      if (task) laborCost.task = task
      if (cost) laborCost.cost = cost
      if (date) laborCost.date = new Date(date)

      await laborCost.save()

      // Invalidate related cache entries
      cache.removeCache(`labor_costs:*`)

      res.status(200).json(laborCost)
    } catch (error) {
      logger.logException(error)
      res.status(500).json({
        error: "Failed to update labor cost entry",
        details: error.message,
      })
    }
  }

  /**
   * Delete labor cost entry
   */
  const deleteLaborCost = async (req, res) => {
    try {
      const { laborCostId } = req.params

      if (!mongoose.Types.ObjectId.isValid(laborCostId)) {
        return res.status(400).json({ error: "Invalid labor cost ID format" })
      }

      const laborCost = await LaborCost.findById(laborCostId)

      if (!laborCost) {
        return res.status(404).json({ error: "Labor cost entry not found" })
      }

      // Delete the labor cost entry
      await LaborCost.deleteOne({ _id: laborCostId })

      // Invalidate caches
      cache.removeCache(`labor_costs:*`)

      res.status(200).json({ message: "Labor cost entry deleted successfully" })
    } catch (error) {
      logger.logException(error)
      res.status(500).json({
        error: "Failed to delete labor cost entry",
        details: error.message,
      })
    }
  }

  /**
   * Get labor costs by project
   */
  const getLaborCostsByProject = async (req, res) => {
    try {
      const { projectName } = req.params
      const { tasks, start_date, end_date } = req.query

      // Create cache key based on query parameters
      const tasksKey = tasks ? tasks.sort().join(",") : "all"
      const cacheKey = `labor_costs_project:${projectName}:${tasksKey}:${start_date || ""}:${end_date || ""}`

      // Try to get data from cache first
      if (cache.hasCache(cacheKey)) {
        return res.status(200).json(cache.getCache(cacheKey))
      }

      // Build query for MongoDB
      const query = { project_name: projectName }

      // Filter by tasks if provided
      if (tasks) {
        const taskList = Array.isArray(tasks) ? tasks : [tasks]
        query.task = { $in: taskList }
      }

      // Filter by date range if provided
      if (start_date || end_date) {
        query.date = {}

        if (start_date) {
          query.date.$gte = new Date(start_date)
        }

        if (end_date) {
          query.date.$lte = new Date(end_date)
        }
      }

      // Fetch data with aggregation pipeline for grouped bar chart
      const laborCostsByTask = await LaborCost.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$task",
            totalCost: { $sum: "$cost" },
          },
        },
        {
          $project: {
            _id: 0,
            task: "$_id",
            cost: "$totalCost",
          },
        },
        { $sort: { task: 1 } },
      ])

      // Calculate total cost
      const totalCost = laborCostsByTask.reduce((sum, item) => sum + item.cost, 0)

      const response = {
        project: projectName,
        totalCost,
        taskBreakdown: laborCostsByTask,
      }

      // Store in cache
      cache.setCache(cacheKey, response, 3600) // Cache for 1 hour

      return res.status(200).json(response)
    } catch (error) {
      logger.logException(error)
      return res.status(500).json({
        error: "Failed to fetch labor costs for project",
        details: error.message,
      })
    }
  }

  return {
    getLaborCosts,
    addLaborCost,
    updateLaborCost,
    deleteLaborCost,
    getLaborCostsByProject,
  }
}

module.exports = laborCostController
