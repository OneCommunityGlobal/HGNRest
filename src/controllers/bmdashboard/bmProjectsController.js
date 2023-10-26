const mongoose = require('mongoose');
const UserProfile = require('../../models/userProfile')

const bmProjectsController = function () {

    //Get current user's Housing/Building projects
    const getUserActiveBMProjects = function (req, res) {
            try {
            const userId = req.body.requestor.requestorId;
            UserProfile.findById(userId)
            .populate([
                {
                  path: 'projects',
                  select: '_id projectName category isActive',
                  match: { category: 'Housing' },
                }
              ])
            .select({
                projects: 1
               })
            .then((results) => {
                       res.status(200).send(results);
               })
            .catch(error => res.status(500).send(error));
            } 
        
            catch (err) {
            res.json(err);
            }
        
        };
    return { getUserActiveBMProjects };
}

module.exports = bmProjectsController;