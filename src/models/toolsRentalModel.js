const mongoose = require("mongoose")

// Main schema for tools cost data - supports both breakdown and time series analysis
const toolsCostSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    projectName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    toolName: {
      type: String,
      required: true,
      trim: true,
    },
    cost: {
      type: Number,
      required: true,
      min: 0,
    },
    isRented: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["excavation", "construction", "electrical", "plumbing", "general"],
      default: "general",
    },
    vendor: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
)

// Compound indexes for dashboard queries
toolsCostSchema.index({ projectName: 1, date: 1 })
toolsCostSchema.index({ date: 1, isRented: 1 })
toolsCostSchema.index({ projectId: 1, date: 1, isRented: 1 })
toolsCostSchema.index({ projectName: 1, isRented: 1, date: 1 })

// Project schema for the dashboard filter
const projectSchema = new mongoose.Schema(
  {
    projectName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    projectCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "completed", "on-hold", "cancelled"],
      default: "active",
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
    },
    location: {
      type: String,
      trim: true,
    },
    manager: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
)

// Virtual field for projectId as string (for frontend compatibility)
projectSchema.virtual("projectId").get(function () {
  return this._id.toHexString()
})

projectSchema.set("toJSON", { virtuals: true })

// Static method for tools cost breakdown (stacked bar chart data)
toolsCostSchema.statics.getToolsCostBreakdown = function (projectIds, startDate, endDate) {
  const matchConditions = {
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  }

  // Filter by specific projects if provided
  if (projectIds && projectIds.length > 0) {
    const objectIds = projectIds.map((id) => new mongoose.Types.ObjectId(id))
    matchConditions.projectId = { $in: objectIds }
  }

  return this.aggregate([
    { $match: matchConditions },
    {
      $group: {
        _id: "$projectName",
        ownedToolsCost: {
          $sum: {
            $cond: [{ $eq: ["$isRented", false] }, "$cost", 0],
          },
        },
        rentedToolsCost: {
          $sum: {
            $cond: [{ $eq: ["$isRented", true] }, "$cost", 0],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        projectName: "$_id",
        ownedToolsCost: { $round: ["$ownedToolsCost", 2] },
        rentedToolsCost: { $round: ["$rentedToolsCost", 2] },
      },
    },
    { $sort: { projectName: 1 } },
  ])
}

// Static method for rentals cost over time (line chart data)
toolsCostSchema.statics.getRentalsCostOverTime = function (projectId, startDate, endDate) {
  const matchConditions = {
    isRented: true,
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
  }

  // Filter by specific project if provided
  if (projectId && projectId.trim() !== "") {
    matchConditions.projectId = new mongoose.Types.ObjectId(projectId)
  }

  return this.aggregate([
    { $match: matchConditions },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$date" },
        },
        value: { $sum: "$cost" },
      },
    },
    {
      $project: {
        _id: 0,
        date: "$_id",
        value: { $round: ["$value", 2] },
      },
    },
    { $sort: { date: 1 } },
  ])
}

// Static method to get all available projects for dashboard filters
toolsCostSchema.statics.getAvailableProjects = function () {
  return this.aggregate([
    {
      $group: {
        _id: {
          projectId: "$projectId",
          projectName: "$projectName",
        },
        totalCost: { $sum: "$cost" },
        entryCount: { $sum: 1 },
        firstEntry: { $min: "$date" },
        lastEntry: { $max: "$date" },
      },
    },
    {
      $project: {
        _id: 0,
        projectId: "$_id.projectId",
        projectName: "$_id.projectName",
        totalCost: { $round: ["$totalCost", 2] },
        entryCount: 1,
        dateRange: {
          start: "$firstEntry",
          end: "$lastEntry",
        },
      },
    },
    { $sort: { projectName: 1 } },
  ])
}

// Static method to seed comprehensive dashboard data
toolsCostSchema.statics.seedDashboardData = async function () {
  try {
    // Check if data already exists
    const existingData = await this.countDocuments()
    if (existingData > 0) {
      console.log("Dashboard data already exists")
      return { message: "Data already exists", count: existingData }
    }

    // Create projects first
    const projects = [
      {
        id: new mongoose.Types.ObjectId(),
        name: "Site A",
        code: "PROJ001",
        location: "Downtown Construction",
        manager: "John Smith",
      },
      {
        id: new mongoose.Types.ObjectId(),
        name: "Site B",
        code: "PROJ002",
        location: "Suburban Development",
        manager: "Jane Doe",
      },
      {
        id: new mongoose.Types.ObjectId(),
        name: "Site C",
        code: "PROJ003",
        location: "Industrial Complex",
        manager: "Bob Johnson",
      },
      {
        id: new mongoose.Types.ObjectId(),
        name: "Site D",
        code: "PROJ004",
        location: "Residential Area",
        manager: "Alice Brown",
      },
      {
        id: new mongoose.Types.ObjectId(),
        name: "Site E",
        code: "PROJ005",
        location: "Commercial District",
        manager: "Charlie Wilson",
      },
    ]

    // Insert projects into Project collection
    const Project = mongoose.model("Project")
    await Project.insertMany(
      projects.map((p) => ({
        _id: p.id,
        projectName: p.name,
        projectCode: p.code,
        status: "active",
        startDate: new Date("2024-01-01"),
        location: p.location,
        manager: p.manager,
      })),
    )

    // Tool categories for realistic data
    const toolCategories = {
      excavation: [
        { name: "Excavator", baseRentalCost: 1500, baseOwnedCost: 800 },
        { name: "Bulldozer", baseRentalCost: 1200, baseOwnedCost: 600 },
        { name: "Backhoe", baseRentalCost: 900, baseOwnedCost: 500 },
        { name: "Trencher", baseRentalCost: 600, baseOwnedCost: 300 },
      ],
      construction: [
        { name: "Crane", baseRentalCost: 2000, baseOwnedCost: 1000 },
        { name: "Mixer", baseRentalCost: 400, baseOwnedCost: 200 },
        { name: "Compactor", baseRentalCost: 300, baseOwnedCost: 150 },
        { name: "Scaffolding", baseRentalCost: 200, baseOwnedCost: 100 },
      ],
      electrical: [
        { name: "Generator", baseRentalCost: 500, baseOwnedCost: 250 },
        { name: "Welder", baseRentalCost: 300, baseOwnedCost: 150 },
        { name: "Drill", baseRentalCost: 100, baseOwnedCost: 50 },
        { name: "Wire Puller", baseRentalCost: 150, baseOwnedCost: 75 },
      ],
      general: [
        { name: "Hammer", baseRentalCost: 50, baseOwnedCost: 25 },
        { name: "Saw", baseRentalCost: 80, baseOwnedCost: 40 },
        { name: "Ladder", baseRentalCost: 60, baseOwnedCost: 30 },
        { name: "Toolbox", baseRentalCost: 40, baseOwnedCost: 20 },
      ],
    }

    const sampleData = []

    // Generate data for the last 90 days to support both charts
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - 90)

    for (const project of projects) {
      // Generate daily entries for each project
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        // Generate 2-6 tool entries per day per project
        const entriesPerDay = Math.floor(Math.random() * 5) + 2

        for (let i = 0; i < entriesPerDay; i++) {
          // Random category and tool
          const categories = Object.keys(toolCategories)
          const category = categories[Math.floor(Math.random() * categories.length)]
          const tools = toolCategories[category]
          const tool = tools[Math.floor(Math.random() * tools.length)]

          // Determine rental vs owned (60% rental for expensive tools, 30% for cheap tools)
          const isExpensive = tool.baseRentalCost > 500
          const isRented = isExpensive ? Math.random() > 0.4 : Math.random() > 0.7

          // Calculate cost with some randomness
          const baseCost = isRented ? tool.baseRentalCost : tool.baseOwnedCost
          const variationFactor = 0.8 + Math.random() * 0.4 // ±20% variation
          const cost = Math.round(baseCost * variationFactor * 100) / 100

          sampleData.push({
            projectId: project.id,
            projectName: project.name,
            toolName: tool.name,
            cost: cost,
            isRented: isRented,
            date: new Date(d),
            category: category,
            vendor: isRented ? `Rental Co ${Math.floor(Math.random() * 3) + 1}` : "Internal",
            description: `${tool.name} usage for ${project.name}`,
          })
        }
      }
    }

    // Insert all sample data
    const result = await this.insertMany(sampleData)
    console.log(`Inserted ${result.length} dashboard records`)

    return {
      message: "Dashboard data created successfully",
      toolsCount: result.length,
      projectsCount: projects.length,
      dateRange: { startDate, endDate },
      categories: Object.keys(toolCategories),
    }
  } catch (error) {
    console.error("Error seeding dashboard data:", error)
    throw error
  }
}

// Create models
const ToolsCost = mongoose.model("ToolsCost", toolsCostSchema)
const Project = mongoose.model("Project", projectSchema)

module.exports = {
  ToolsCost,
  Project,
}