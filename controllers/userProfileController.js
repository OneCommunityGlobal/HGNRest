var team = require('../models/team');
var mongoose = require('mongoose');
var userhelper = require('../helpers/userhelper')();
var bcrypt = require('bcryptjs');


var userProfileController = function (userProfile) {


  var getUserProfiles = function (req, res) {

    let AuthorizedRolesToView = ['Manager', 'Administrator', 'Core Team'];
    var isRequestorAuthorized = (AuthorizedRolesToView.includes(req.body.requestor.role) || req.body.requestor.requestorId === userid) ? true : false;


    if (!isRequestorAuthorized) {
      res.status(403).send("You are not authorized to view all users");
      return;
    }

    userProfile.find({}, '_id firstName lastName role weeklyComittedHours email', function (err, profiles) {
      if (err) {
        res.status(404).send("Error finding user profiles");
        return;
      }
      res.json(profiles);
    });

  };

  var getProjectMembers = function (req, res) {
    //console.log(req.params.projectId);
    let AuthorizedRolesToView = ['Manager', 'Administrator', 'Core Team'];
    var isRequestorAuthorized = (AuthorizedRolesToView.includes(req.body.requestor.role) || req.body.requestor.requestorId === userid) ? true : false;
    if (!isRequestorAuthorized) {
      res.status(403).send("You are not authorized to view all users");
      return;
    }
    userProfile.find({projects:{$in:[req.params.projectId]}}, '_id firstName email', function (err, profiles) {
      if (err) {
        res.status(404).send("Error finding user profiles");
        return;
      }
      res.json(profiles);
    });
  };

  var postUserProfile = async function (req, res) {

    if (req.body.requestor.role !== "Administrator") {
      res.status(403).send("You are not authorized to create new users");
      return;
    }


    let _email = (req.body.email).toLowerCase();


    let userbyemail = await userProfile.findOne({
      email: _email
    });

    if (userbyemail) {
      let errorMessage = "Email already exists. Please choose another email.";
      res.status(400).send({
        error: errorMessage
      });
      return;
    }



    var up = new userProfile();
    up.password = req.body.password;
    up.role = req.body.role;
    up.firstName = req.body.firstName;
    up.lastName = req.body.lastName;
    up.email = _email;
    up.phoneNumber = req.body.phoneNumber;
    up.bio = req.body.bio;
    up.weeklyComittedHours = req.body.weeklyComittedHours;
    up.personalLinks = req.body.personalLinks;
    up.adminLinks = req.body.adminLinks;
    up.teams = Array.from(new Set(req.body.teams));
    up.projects = Array.from(new Set(req.body.projects));
    up.createdDate = Date.now();


    up.save()
      .then(function (results) {
        res.status(200).send({
          _id: up._id
        });
      })
      .catch(error => res.status(501).send(error));


  }

  var putUserProfile = function (req, res) {

    let userid = req.params.userId;

    let isRequestorAuthorized = (req.body.requestor.role === "Administrator" || req.body.requestor.requestorId === userid) ? true : false;
    let isRequestorAdmin = (req.body.requestor.role === "Administrator") ? true : false;

    if (!isRequestorAuthorized) {
      res.status(403).send("You are not authorized to update this user");
      return;
    }
    userProfile.findById(userid, function (err, record) {

      if (err || record == null) {

        if (record == null) err = " No valid records found";

        res.status(404).send(err);
        return;
      }

      record.profilePic = req.body.profilePic;
      record.firstName = req.body.firstName;
      record.lastName = req.body.lastName;
      record.phoneNumber = req.body.phoneNumber;
      record.bio = req.body.bio;
      record.personalLinks = req.body.personalLinks;
      record.lastModifiedDate = Date.now();
      record.profilePic = req.body.profilePic;


      if (isRequestorAdmin) {
        record.role = req.body.role;
        record.isActive = req.body.isActive;
        record.weeklyComittedHours = req.body.weeklyComittedHours;
        record.adminLinks = req.body.adminLinks;
        record.teams = Array.from(new Set(req.body.teams));
        record.projects = Array.from(new Set(req.body.projects));
        record.isActive = req.body.isActive;
      }
      record.save()
        .then(function (results) {
          res.status(200).send({
            _id: record._id
          });
        })
        .catch(error => res.status(400).send(error));


    });

  };


  var getUserById = function (req, res) {

    let userid = req.params.userId;
    let user = {};
    let teamid = "";

    userProfile.findById(userid, '-password -lastModifiedDate -createdDate -__v')
      .populate('teams', '_id teamName')
      .populate("projects", '_id projectName')
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));

  };

  var updatepassword = function (req, res) {

    let userId = req.params.userId;
    let requestor = req.body.requestor;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).send({ "error": "Bad Request" });
      return;
    }

    //Verify correct params in body
    if (!req.body.currentpassword || !req.body.newpassword || !req.body.confirmnewpassword) {
      res.status(400).send({ "error": "One of more required fields are missing" });
      return;
    }
    // Verify request is authorized by self or adminsitrator
    if (!userId === requestor.requestorId && !requestor.role === "Administrator") {
      res.status(403).send({ "error": "You are unauthorized to update this user's password" });
      return;
    }
    //Verify new and confirm new password are correct

    if (req.body.newpassword != req.body.confirmnewpassword) {
      res.status(400).send({ "error": "New and confirm new passwords are not same" });
    }

    //Verify old and new passwords are not same
    if (req.body.currentpassword === req.body.newpassword) {
      res.status(400).send({ "error": "Old and confirm new passwords should not be same" });
    }

    userProfile.findById(userId, 'password')
      .then(user => {
        bcrypt.compare(req.body.currentpassword, user.password)
          .then((passwordMatch) => {
            if (passwordMatch) {
              user.set({ password: req.body.newpassword });
              user.save()
                .then(results => {
                  res.status(200).send({ "message": "updated password" });
                  return;
                })
                .catch(error => {
                  res.status(500).send(error);
                  return;
                })
            }
            else {
              res.status(400).send({ "error": "Incorrect current password" });
              return;
            }

          })
          .catch(error => {
            res.status(500).send(error);
            return;

          })

      })
      .catch(error => {
        res.status(400).send(error);
        return;
      })


  };

  var getreportees = function (req, res) {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      res.status(400).send({ "error": "Bad request" });
      return;
    }

    var userid = mongoose.Types.ObjectId(req.params.userId);
    var role = req.body.requestor.role;

    let validroles = ['Volunteer', 'Manager', 'Administrator', 'Core Team'];

    if (role === "Volunteer" || role === "Manager") {
      validroles = ["Volunteer", "Manager"]
    }


    userhelper.getTeamMembers({ _id: userid })
      .then(results => {
        var teammembers = [];

        results.myteam.forEach(element => {
          if (!validroles.includes(element.role)) return;
          teammembers.push(element);
        });
        res.status(200).send(teammembers);

      })
      .catch(error => res.status(400).send(error));
  };

  var getTeamMembersofUser = function (req, res) {

    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
      res.status(400).send({ "error": "Bad request" });
      return;
    }
    userhelper.getTeamMembers({ _id: req.params.userId })
      .then(results => {
        res.status(200).send(results);
      })
      .catch(error => res.status(400).send(error));
  };


  var getUserName = function (req, res) {
    var userId = req.params.userId;

    if (mongoose.Types.ObjectId.isValid(userId)) {

      userProfile.findById(userId, 'firstName lastName')
        .then(result => {
          let name = result.firstName + " " + result.lastName;
          res.status(200).send({ "name": name });
          return;
        })
        .catch(error => {
          res.status(404).send(error)
          return;
        });


    }
    else {
      res.status(400).send({ "error": "Bad request" })
    }

  }



  return {

    postUserProfile: postUserProfile,
    getUserProfiles: getUserProfiles,
    putUserProfile: putUserProfile,
    getUserById: getUserById,
    getreportees: getreportees,
    updatepassword: updatepassword,
    getUserName: getUserName,
    getTeamMembersofUser: getTeamMembersofUser,
    getProjectMembers: getProjectMembers
  };

};

module.exports = userProfileController;
