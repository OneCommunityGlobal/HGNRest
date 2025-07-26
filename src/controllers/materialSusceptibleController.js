const mongoose = require('mongoose');
const projectMaterial = require('../models/projectMaterial');

// new controller
export const createProjectMaterial = async (req, res) => {
    const projectMaterialbody = req.body;

    if(!projectMaterialbody.projectName || !projectMaterialbody.toolName || !projectMaterialbody.replacedPercentage || !projectMaterialbody.date){
        return res.status(400).json({success:false, message: "Please provide all fields"});
    }
    if (Number.isNaN(Number(projectMaterialbody.replacedPercentage)) || projectMaterialbody.replacedPercentage <= 0){
        return res.status(400).json({success:false, message: "Cost Cannot be less than or 0!"});
    }

    const newProjectMaterial = new projectMaterial(projectMaterialbody);

    try{
        await newProjectMaterial.save();
        res.status(201).json({success: true, data: newProjectMaterial, message: "Project Material entry added successfully",});
    } catch(error){
        console.error("Error in Adding Project Material:", error.message);
        res.status(500).json({success: false, message: "Server Error"});
    }
}

export const getProjectMaterial = async (req, res) => {
    try {
      const projectMaterialRes = await projectMaterial.find({});
      res.status(200).json({ success: true, data: projectMaterialRes });
    } catch (error) {
      console.log("error in fetching Project Material costs:", error.message);
      res.status(500).json({ success: false, message: "Server Error" });
    }
}

export const getProjectMaterialByDate = async (req, res) => {
    const {startDate, endDate} = req.query;

    if(!startDate || !endDate){
        res.status(500).json({success:false, message: "Both startdate and enddate are required"});
    }
    try{
        const filteredData = await projectMaterial.find({
            date: {
              $gte: new Date(startDate),
              $lte: new Date(endDate),
            },
          });
        res.status(200).json({success: true, data: filteredData});
    } catch(error){
        console.log("error in fetching Project Material costs by date:", error.message);
        res.status(500).json({ success: false, message: "Server Error" });
    }
}

export const getProjectMaterialByProject = async (req, res) => {
    const {project_name} = req.query;

    if(!project_name){
        res.status(500).json({success:false, message: "Project Name not provided"});
    }

    try{
        const filteredDatabyProject = await projectMaterial.find({
            projectName: { $regex: project_name, $options: "i" }
        })
        res.status(200).json({success: true, data: filteredDatabyProject});
    } catch(error){
        console.log("error in fetching data by project name:", error.message);
        res.status(500).json({ success: false, message: "Server Error" });
    }
}