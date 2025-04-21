const mongoose = require('mongoose');

const bmOrgsController = function() {
    const Organizations = require('../../models/bmdashboard/orgLocation');
    const getAllOrgs = async(req, res) => {
        try {
            // query parameters             
            const {startDate, endDate} = req.query;
            let query = {};
            
            // build query if date filters provided             
            if (startDate || endDate) {
                if (startDate) query.startDate = {$gte: new Date(startDate)};
                if (endDate) query.endDate = {$lte: new Date(endDate)};
            }
            
            // execute query and find org
            const orgs = await Organizations.find(query)
                .select('orgId name location status startDate country')
                .lean()
                .exec();
                            
            // transform data             
            const transformedOrgs = orgs
                .filter(org => org.location && org.location.coordinates && org.location.coordinates.length === 2)
                .map(org => ({
                    orgId: org.orgId,
                    name: org.name,
                    latitude: org.location.coordinates[1],
                    longitude: org.location.coordinates[0],
                    status: org.status,
                    startDate: org.startDate,
                    country: org.country
                }));
                
            // send response                 
            res.status(200).json({
                success: true,
                count: transformedOrgs.length,
                data: transformedOrgs
            });
        } catch(err) {
            console.error('Error in getAllOrgs:', err);
            res.status(500).json({
                success: false,
                error: 'Server error ' + err.message
            });
        }
    };

    const getOrgById = async (req, res) => {
        try {
            const {id} = req.params;
            Organizations
                .findOne({orgId: id})
                .select('orgId name location status startDate')
                .then(org => {
                    if (!org) {
                        return res.status(404).json({
                            success: false,
                            error: 'Organization not found'
                        });
                    }
                    
                    // transformed org                     
                    const transformedOrg = {
                        orgId: org.orgId,
                        name: org.name,
                        latitude: org.location.coordinates[1],
                        longitude: org.location.coordinates[0],
                        status: org.status,
                        startDate: org.startDate
                    };
                    
                    res.status(200).json({
                        success: true,
                        data: transformedOrg
                    });
                });
        } catch (err) {
            console.error('Error in getOrgById:', err);
            res.status(500).json({
                success: false,
                error: 'Server error ' + err.message
            });
        }
    };

    return {
        getAllOrgs,
        getOrgById
    };
};

module.exports = bmOrgsController;
