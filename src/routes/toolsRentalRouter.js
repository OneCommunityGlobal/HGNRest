const express = require("express")
const router = express.Router()
const {
  getProjects,
  getToolsCostBreakdown,
  getRentalsCostOverTime,
  getDashboardSummary,
  seedDashboardData,
  createToolsCostEntry,
} = require("../controllers/toolsRentalController")

// Projects endpoint for filter dropdown
router.get("/projects", getProjects)

// Tools cost breakdown endpoint for stacked bar chart
router.get("/tools/cost-breakdown", getToolsCostBreakdown)

// Rentals cost over time endpoint for line chart
router.get("/rentals/cost-over-time", getRentalsCostOverTime)

// Additional dashboard endpoints
router.get("/dashboard/summary", getDashboardSummary)

// Data management endpoints
router.post("/tools/cost-entry", createToolsCostEntry)
router.post("/seed-data", seedDashboardData)

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Tools Cost Dashboard API is running",
    endpoints: {
      projects: "GET /api/projects",
      breakdown: "GET /api/tools/cost-breakdown",
      rentals: "GET /api/rentals/cost-over-time",
      summary: "GET /api/dashboard/summary",
      createEntry: "POST /api/tools/cost-entry",
      seedData: "POST /api/seed-data",
    },
    timestamp: new Date().toISOString(),
  })
})

module.exports = router
