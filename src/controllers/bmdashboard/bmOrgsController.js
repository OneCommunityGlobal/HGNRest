const mongoose = require('mongoose');

const bmOrgsController = function () {
    const Organizations = require('../../models/bmdashboard/orgLocation');
    
    const getAllOrgs = async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            let query = {};
            
            if (startDate || endDate) {
                query.startDate = {};
                if (startDate) query.startDate.$gte = new Date(startDate);
                if (endDate) query.endDate = { $lte: new Date(endDate) };
            }
            
            Organizations
                .find(query)
                .select('orgId name location status startDate')
                .then(orgs => {
                    const transformedOrgs = orgs.map(org => ({
                        orgId: org.orgId,
                        name: org.name,
                        latitude: org.location.coordinates[1],
                        longitude: org.location.coordinates[0],
                        status: org.status,
                        startDate: org.startDate
                    }));
                    
                    res.status(200).json({
                        success: true,
                        count: transformedOrgs.length,
                        data: transformedOrgs
                    });
                })
                .catch(error => {
                    console.error('Error fetching orgs:', error);
                    res.status(500).json({
                        success: false,
                        error: 'Server Error'
                    });
                });
        } catch (err) {
            console.error('Exception in getAllOrgs:', err);
            res.status(500).json({
                success: false,
                error: 'Server Error'
            });
        }
    };
    
    const getOrgById = async (req, res) => {
        try {
            const { id } = req.params;
            
            Organizations
                .findOne({ orgId: id })
                .select('orgId name location status startDate')
                .then(org => {
                    if (!org) {
                        return res.status(404).json({
                            success: false,
                            error: 'Organization not found'
                        });
                    }
                    
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
                })
                .catch(error => {
                    console.error('Error fetching org by ID:', error);
                    res.status(500).json({
                        success: false,
                        error: 'Server Error'
                    });
                });
        } catch (err) {
            console.error('Exception in getOrgById:', err);
            res.status(500).json({
                success: false,
                error: 'Server Error'
            });
        }
    };
    
    return {
        getAllOrgs,
        getOrgById
    };
};

module.exports = bmOrgsController;
