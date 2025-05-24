const { ToolsCost, Project } = require("../models/toolsRentalModel")
const mongoose = require("mongoose")

// Helper functions for validation
const isValidDate = (dateString) => {
  const regex = /^\d{4}-\d{2}-\d{2}$/
  if (!regex.test(dateString)) return false
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date) && dateString === date.toISOString().split("T")[0]
}

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id)
}

const parseProjectIds = (projectsParam) => {
  if (!projectsParam || projectsParam.trim() === "") {
    return []
  }
  const projectIds = projectsParam
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id !== "")

  const invalidIds = projectIds.filter((id) => !isValidObjectId(id))
  if (invalidIds.length > 0) {
    throw new Error(`Invalid project IDs: ${invalidIds.join(", ")}`)
  }
  return projectIds
}

// Controller for getting all projects (for dashboard filter dropdown)
const getProjects = async (req, res) => {
  try {
    // Get projects from the dedicated Project collection
    const projects = await Project.find({ status: "active" })
      .select("projectName projectCode _id")
      .sort({ projectName: 1 })

    // Format for frontend compatibility
    const formattedProjects = projects.map((project) => ({
      projectId: project._id.toString(),
      projectName: project.projectName,
      projectCode: project.projectCode || "",
    }))

    // If no projects in Project collection, get from ToolsCost aggregation
    if (formattedProjects.length === 0) {
      const projectsFromTools = await ToolsCost.getAvailableProjects()
      return res.status(200).json(
        projectsFromTools.map((p) => ({
          projectId: p.projectId.toString(),
          projectName: p.projectName,
        })),
      )
    }

    res.status(200).json(formattedProjects)
  } catch (error) {
    console.error("Error fetching projects:", error)
    res.status(500).json({
      error: "Failed to fetch projects",
      message: error.message,
    })
  }
}

// Controller for tools cost breakdown (stacked bar chart)
const getToolsCostBreakdown = async (req, res) => {
  try {
    const { startDate, endDate, projects } = req.query

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: "Missing required parameters: startDate and endDate",
        example: "?startDate=2024-01-01&endDate=2024-12-31&projects=proj1,proj2",
      })
    }

    // Validate date formats
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({
        error: "Invalid date format. Use YYYY-MM-DD format",
        provided: { startDate, endDate },
      })
    }

    // Validate date range
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        error: "startDate must be before or equal to endDate",
      })
    }

    // Parse project IDs
    let projectIds = []
    try {
      projectIds = parseProjectIds(projects)
    } catch (error) {
      return res.status(400).json({
        error: "Invalid project IDs",
        message: error.message,
      })
    }

    console.log(`Tools Cost Breakdown Request:`, {
      startDate,
      endDate,
      projectCount: projectIds.length,
    })

    // Get breakdown data
    const breakdownData = await ToolsCost.getToolsCostBreakdown(
      projectIds.length > 0 ? projectIds : null,
      startDate,
      endDate,
    )

    res.status(200).json(breakdownData)
  } catch (error) {
    console.error("Error fetching tools cost breakdown:", error)
    res.status(500).json({
      error: "Failed to fetch tools cost breakdown",
      message: error.message,
    })
  }
}

// Controller for rentals cost over time (line chart)
const getRentalsCostOverTime = async (req, res) => {
  try {
    const { projectId, startDate, endDate } = req.query

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: "Missing required parameters: startDate and endDate",
        example: "?projectId=proj1&startDate=2024-01-01&endDate=2024-12-31",
      })
    }

    // Validate date formats
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({
        error: "Invalid date format. Use YYYY-MM-DD format",
        provided: { startDate, endDate },
      })
    }

    // Validate project ID if provided
    if (projectId && projectId.trim() !== "" && !isValidObjectId(projectId)) {
      return res.status(400).json({
        error: "Invalid project ID format",
        provided: projectId,
      })
    }

    // Validate date range
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        error: "startDate must be before or equal to endDate",
      })
    }

    console.log(`Rentals Cost Over Time Request:`, {
      projectId: projectId || "all projects",
      startDate,
      endDate,
    })

    // Get rentals cost data
    const rentalsCostData = await ToolsCost.getRentalsCostOverTime(projectId || null, startDate, endDate)

    res.status(200).json(rentalsCostData)
  } catch (error) {
    console.error("Error fetching rentals cost over time:", error)
    res.status(500).json({
      error: "Failed to fetch rentals cost over time",
      message: error.message,
    })
  }
}

// Controller for dashboard summary statistics
const getDashboardSummary = async (req, res) => {
  try {
    const { startDate, endDate, projects } = req.query

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: "Missing required parameters: startDate and endDate",
      })
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return res.status(400).json({
        error: "Invalid date format. Use YYYY-MM-DD format",
      })
    }

    let projectIds = []
    try {
      projectIds = parseProjectIds(projects)
    } catch (error) {
      return res.status(400).json({
        error: "Invalid project IDs",
        message: error.message,
      })
    }

    // Get summary statistics
    const matchConditions = {
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      },
    }

    if (projectIds.length > 0) {
      matchConditions.projectId = { $in: projectIds.map((id) => new mongoose.Types.ObjectId(id)) }
    }

    const summary = await ToolsCost.aggregate([
      { $match: matchConditions },
      {
        $group: {
          _id: null,
          totalCost: { $sum: "$cost" },
          totalOwnedCost: {
            $sum: { $cond: [{ $eq: ["$isRented", false] }, "$cost", 0] },
          },
          totalRentedCost: {
            $sum: { $cond: [{ $eq: ["$isRented", true] }, "$cost", 0] },
          },
          totalEntries: { $sum: 1 },
          uniqueProjects: { $addToSet: "$projectName" },
          uniqueTools: { $addToSet: "$toolName" },
          dateRange: {
            $push: "$date",
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalCost: { $round: ["$totalCost", 2] },
          totalOwnedCost: { $round: ["$totalOwnedCost", 2] },
          totalRentedCost: { $round: ["$totalRentedCost", 2] },
          totalEntries: 1,
          projectCount: { $size: "$uniqueProjects" },
          toolCount: { $size: "$uniqueTools" },
          rentalPercentage: {
            $round: [{ $multiply: [{ $divide: ["$totalRentedCost", "$totalCost"] }, 100] }, 1],
          },
          firstEntry: { $min: "$dateRange" },
          lastEntry: { $max: "$dateRange" },
        },
      },
    ])

    const result = summary[0] || {
      totalCost: 0,
      totalOwnedCost: 0,
      totalRentedCost: 0,
      totalEntries: 0,
      projectCount: 0,
      toolCount: 0,
      rentalPercentage: 0,
    }

    res.status(200).json(result)
  } catch (error) {
    console.error("Error fetching dashboard summary:", error)
    res.status(500).json({
      error: "Failed to fetch dashboard summary",
      message: error.message,
    })
  }
}

// Controller for seeding dashboard data
const seedDashboardData = async (req, res) => {
  try {
    const result = await ToolsCost.seedDashboardData()
    res.status(200).json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error("Error seeding dashboard data:", error)
    res.status(500).json({
      error: "Failed to seed dashboard data",
      message: error.message,
    })
  }
}

// Controller for creating new tool cost entry
const createToolsCostEntry = async (req, res) => {
  try {
    const { projectId, projectName, toolName, cost, isRented, date, category, vendor, description } = req.body

    // Validate required fields
    if (!projectId || !projectName || !toolName || cost === undefined || isRented === undefined || !date) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["projectId", "projectName", "toolName", "cost", "isRented", "date"],
      })
    }

    // Validate data types
    if (!isValidObjectId(projectId)) {
      return res.status(400).json({ error: "Invalid project ID format" })
    }

    if (typeof cost !== "number" || cost < 0) {
      return res.status(400).json({ error: "Cost must be a positive number" })
    }

    if (!isValidDate(date)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" })
    }

    // Create new entry
    const newEntry = new ToolsCost({
      projectId,
      projectName,
      toolName,
      cost,
      isRented,
      date: new Date(date),
      category,
      vendor,
      description,
    })

    const savedEntry = await newEntry.save()
    res.status(201).json(savedEntry)
  } catch (error) {
    console.error("Error creating tools cost entry:", error)
    res.status(500).json({
      error: "Failed to create tools cost entry",
      message: error.message,
    })
  }
}

module.exports = {
  getProjects,
  getToolsCostBreakdown,
  getRentalsCostOverTime,
  getDashboardSummary,
  seedDashboardData,
  createToolsCostEntry,
}