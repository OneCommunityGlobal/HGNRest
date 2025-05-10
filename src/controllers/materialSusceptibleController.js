const mongoose = require('mongoose');
const projectMaterial = require('../../models/projectMaterial');

const materialSusceptibleController = {

    // retrieve all expenditure datasr
    getAllMaterial: async (req, res) => {
        try {
            const materials = await projectMaterial.find()
                .select('projectId project tool inUse needsReplacement yetToReceive')
                .lean()
                .exec();

            // transform data 
            const transformedMaterials = materials.map(material => ({

                projectId: material.projectId,
                project: material.project,
                tool: material.tool,
                inUse: material.inUse,
                needsReplacement: material.needsReplacement,
                yetToReceive: material.yetToReceive,
            }));

            res.status(200).json({
                success: true,
                data: transformedMaterials
            });
        } catch (err) {
            console.error("Error in getAllMaterial:", err);
            res.status(500).json({
                success: false,
                error: 'Server error ' + err.message
            });
        }
    }
};

module.exports = materialSusceptibleController;