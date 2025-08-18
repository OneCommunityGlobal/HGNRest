const mongoose = require('mongoose');

const bmRentalChartController = function() {
    const rentalCharts = require('../../models/bmdashboard/buildingRentalChart');

    const getAllRentalCosts = async(req, res) => {
        try{
            const rentals = await rentalCharts.find({})
                .select('projectId date toolName rentalCost totalMaterialCost')
                .lean()
                .exec();

            const transformedRentals = rentals
                .map(rental => ({
                    projectId: rental.projectId,
                    date: rental.date,
                    toolName: rental.toolName,
                    rentalCost: rental.rentalCost,
                    totalMaterialCost: rental.totalMaterialCost
                }));

            res.status(200).json({
                success: true,
                count: transformedRentals.length,
                data: transformedRentals
            });
        } catch(err) {
            res.status(500).json({
                success: false,
                error: `Server error ${  err.message}`
            });
        }
    };

    return {
        getAllRentalCosts
    };
};

module.exports = bmRentalChartController;