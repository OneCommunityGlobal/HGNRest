const mongoose = require("mongoose")
const LaborCost = require("../models/laborCost")
const logger = require("../startup/logger")

const laborCostController = () => {
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

      // Save to database
      await newLaborCost.save()

      // Return success response
      res.status(201).json({
        message: "Labor cost entry added successfully",
        data: newLaborCost,
      })
    } catch (error) {
      logger.logException(error)
      res.status(500).json({
        error: "Failed to add labor cost entry",
        details: error.message,
      })
    }
  }

  // Only return the addLaborCost function
  return {
    addLaborCost,
  }
}

module.exports = laborCostController
