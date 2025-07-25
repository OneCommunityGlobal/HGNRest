const logger = require('../../startup/logger');
const mongoose = require('mongoose');

const bmFinancialController = function (BuildingProject, BuildingMaterial, BuildingTool) {

    const getTotalProjectCost = async (req, res) => {
        try {
            const project = await BuildingProject.findById(req.params.projectId);
            if (!project) {
                logger.logException(`Project with ID ${req.params.projectId} not found`);
                return res.status(404).json({message: 'Project not found'});
            }
            const materialsCost = await calculateMaterialsCost(BuildingMaterial, project._id);
            const toolsCost = await calculateToolsCost(BuildingTool, project._id);
            const laboorCost = await calculateLaborCost(BuildingProject, project._id);

            const totalCost = materialsCost + toolsCost + laboorCost;
            res.status(200).json({
                'totalCost': totalCost
            });
        } catch (error) {
            logger.logException(`Error fetching project cost: ${error.message}`);
            res.status(500).json({message: 'Internal server error'});
        }
    };

    const getCostBreakdown = async (req, res) => {
        try {
            const project = await BuildingProject.findById(req.params.projectId);
            if (!project) {
                logger.logException(`Project with ID ${req.params.projectId} not found`);
                return res.status(404).json({message: 'Project not found'});
            }
            const materialsCost = await calculateMaterialsCost(BuildingMaterial, project._id);
            const toolsCost = await calculateToolsCost(BuildingTool, project._id);
            const laboorCost = await calculateLaborCost(BuildingProject, project._id);

            res.status(200).json({
                'materialsCost': materialsCost,
                'equipmentCost': toolsCost,
                'laborCost': laboorCost
            });

        } catch (error) {
            logger.logException(`Error fetching project cost breakdown: ${error.message}`);
            res.status(500).json({message: 'Internal server error'});
        }
    };

    const mongoose = require('mongoose');

    const getMonthOverMonthChanges = async (req, res) => {
        try {
            const {projectId} = req.params;

            if (!mongoose.Types.ObjectId.isValid(projectId)) {
                return res.status(400).json({message: 'Invalid project ID'});
            }

            const projectObjectId = new mongoose.Types.ObjectId(projectId);

            const now = new Date();
            const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonthStart = new Date(thisMonthStart);
            lastMonthStart.setMonth(thisMonthStart.getMonth() - 1);

            const monthEnd = (monthStart) => {
                const end = new Date(monthStart);
                end.setMonth(end.getMonth() + 1);
                return end;
            };

            const [materialDocs, toolDocs] = await Promise.all([
                BuildingMaterial.find({project: projectObjectId}),
                BuildingTool.find({project: projectObjectId})
            ]);

            const calculateCost = (docs, monthStart) => {
                let cost = 0;
                const end = monthEnd(monthStart);

                docs.forEach(doc => {
                    if (!Array.isArray(doc.purchaseRecord)) return;

                    doc.purchaseRecord.forEach(record => {
                        const rDate = new Date(record.date);
                        if (
                            record.status === 'Approved' &&
                            !isNaN(rDate) &&
                            rDate >= monthStart &&
                            rDate < end
                        ) {
                            cost += (record.quantity || 0) * (record.unitPrice || 0);
                        }
                    });
                });

                return cost;
            };

            const thisMonthMaterialCost = calculateCost(materialDocs, thisMonthStart);
            const lastMonthMaterialCost = calculateCost(materialDocs, lastMonthStart);

            const thisMonthToolCost = calculateCost(toolDocs, thisMonthStart);
            const lastMonthToolCost = calculateCost(toolDocs, lastMonthStart);

            const thisMonthLaborCost = await calculateLaborCost(BuildingProject, projectObjectId);
            const lastMonthLaborCost = thisMonthLaborCost; // Replace with actual last month logic if available

            const calcMoMChange = (current, previous) => {
                if (previous === 0) return current === 0 ? 0 : 100;
                return ((current - previous) / previous) * 100;
            };

            res.status(200).json({
                materialCostChange: parseFloat(calcMoMChange(thisMonthMaterialCost, lastMonthMaterialCost).toFixed(2)),
                laborCostChange: parseFloat(calcMoMChange(thisMonthLaborCost, lastMonthLaborCost).toFixed(2)),
                equipmentCostChange: parseFloat(calcMoMChange(thisMonthToolCost, lastMonthToolCost).toFixed(2))
            });

        } catch (err) {
            res.status(500).json({message: 'Internal server error'});
        }
    };


    const getProjectsFinancialsByType = async (req, res) => {
        try {
            const projectType = req.query.projectType;

            const projects = await BuildingProject.find({projectType});

            const results = await Promise.all(projects.map(async (project) => {
                let materialsCost = 0, toolsCost = 0, laborCost = 0;

                try {
                    materialsCost = await calculateMaterialsCost(BuildingMaterial, project._id);
                } catch (error) {
                    logger.logException(`Materials cost error for project ${project._id}: ${error.message}`);
                }

                try {
                    toolsCost = await calculateToolsCost(BuildingTool, project._id);
                } catch (error) {
                    logger.logException(`Tools cost error for project ${project._id}: ${error.message}`);
                }

                try {
                    laborCost = await calculateLaborCost(BuildingProject, project._id);
                } catch (error) {
                    logger.logException(`Labor cost error for project ${project._id}: ${error.message}`);
                }

                return {
                    projectId: project._id,
                    totalCost: materialsCost + toolsCost + laborCost,
                    materialCost: materialsCost,
                    laborCost,
                    equipmentCost: toolsCost
                };
            }));

            res.status(200).json(results);
        } catch (err) {
            logger.logException(`Error fetching financial data by project type: ${err.message}`);
            res.status(500).json({message: 'Internal server error'});
        }
    };



    const getProjectsFinancialsByDateRange = async (req, res) => {
        try {
            const {startDate, endDate} = req.query;
            const start = new Date(startDate);
            const end = new Date(endDate);

            const projects = await BuildingProject.find({dateCreated: {$gte: start, $lte: end}});

            const results = await Promise.all(projects.map(async (project) => {
                const materialsCost = await calculateMaterialsCost(BuildingMaterial, project._id);
                const toolsCost = await calculateToolsCost(BuildingTool, project._id);
                const laborCost = await calculateLaborCost(BuildingProject, project._id);
                const totalCost = materialsCost + toolsCost + laborCost;

                return {
                    projectId: project._id,
                    totalCost,
                    materialCost: materialsCost,
                    laborCost,
                    equipmentCost: toolsCost
                };
            }));

            res.status(200).json(results);
        } catch (err) {
            logger.logException(`Error fetching financial data by date range: ${err.message}`);
            res.status(500).json({message: 'Internal server error'});
        }
    };


    const calculateMaterialsCost = async (BuildingMaterial, projectId) => {
        try {
            const materials = await BuildingMaterial.find({project: projectId});
            let totalCost = 0;

            if (!materials.length) {
                console.log("No materials found for project:", projectId);
            }

            materials.forEach(material => {
                if (Array.isArray(material.purchaseRecord)) {
                    material.purchaseRecord.forEach(record => {

                        const {quantity = 0, unitPrice = 0, status} = record;

                        if (status?.trim().toLowerCase() === "approved") {
                            totalCost += quantity * unitPrice;
                        }
                    });
                }
            });

            return totalCost;
        } catch (err) {
            console.error('Error calculating materials cost:', err);
            throw err;
        }
    };


    const calculateToolsCost = async (BuildingTool, projectId) => {
        try {
            const tools = await BuildingTool.find({project: projectId});
            let totalCost = 0;

            if (!tools.length) {
                console.log(`No tools found for project: ${projectId}`);
            }

            tools.forEach(tool => {
                if (Array.isArray(tool.purchaseRecord)) {
                    tool.purchaseRecord.forEach(record => {
                        const quantity = record.quantity ?? 0;
                        const unitPrice = record.unitPrice ?? 0;
                        const status = record.status ?? '';

                        if (status.trim().toLowerCase() === "approved") {
                            totalCost += quantity * unitPrice;
                        }
                    });
                }
            });

            console.log("Total tools cost:", totalCost);
            return totalCost;
        } catch (err) {
            console.error('Error calculating tools cost:', err);
            throw err;
        }
    };


    const calculateLaborCost = async (BuildingProject, projectId, hourlyRate = 25) => {
        try {
            const project = await BuildingProject.findById(projectId);
            if (!project || !Array.isArray(project.members)) {
                return 0;
            }
            let totalLaborCost = 0;
            project.members.forEach(member => {
                const hoursWorked = member.hours || 0;
                totalLaborCost += hoursWorked * hourlyRate;
            });
            return totalLaborCost;
        } catch (err) {
            console.error('Error calculating labor cost:', err);
            throw err;
        }
    };

    return {
        getTotalProjectCost,
        getCostBreakdown,
        getMonthOverMonthChanges,
        getProjectsFinancialsByType,
        getProjectsFinancialsByDateRange
    };
};

module.exports = bmFinancialController;
