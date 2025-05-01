const mongoose = require('mongoose');
const Expenditures = require('../../models/bmdashboard/buildingExpenditure');

const bmExpenditureController = {

    // retrieve all expenditure datasr
    getAllExpenditure: async (req, res) => {
        try {
            const expenditures = await Expenditures.find()
                .select('projectId date category cost')
                .lean()
                .exec();
                
            // transform data 
            const transformedExpenditures = expenditures.map(expenditure => ({
                projectId: expenditure.projectId,
                date: expenditure.date,
                category: expenditure.category,
                cost: expenditure.cost,
            }));
            
            res.status(200).json({
                success: true,
                data: transformedExpenditures
            });
        } catch (err) {
            console.error("Error in getAllExpenditure:", err);
            res.status(500).json({
                success: false,
                error: 'Server error ' + err.message
            });
        }
    }
};

module.exports = bmExpenditureController;
