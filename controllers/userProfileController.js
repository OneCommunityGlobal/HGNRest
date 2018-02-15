var team = require('../models/team');
var mongoose = require('mongoose');
var userhelper = require('../helpers/userhelper')();


var userProfileController = function (userProfile) {


  var getUserProfiles = function (req, res) {

    let AuthorizedRolesToView = ['Manager', 'Administrator', 'Core Team'];
    var isRequestorAuthorized = (AuthorizedRolesToView.includes(req.body.requestor.role) || req.body.requestor.requestorId === userid) ? true : false;


    if (!isRequestorAuthorized) {
      res.status(403).send("You are not authorized to view all users");
      return;
    }

    userProfile.find({}, '_id firstName lastName role', function (err, profiles) {
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
    up.teamId = Array.from(new Set(req.body.teamId));
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
        record.weeklyComittedHours = req.body.weeklyComittedHours;
        record.adminLinks = req.body.adminLinks;
        record.TeamId = Array.from(new Set(req.body.teamId));
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
      .populate('teamId', '_id teamName')
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));

  };

  var getreportees = function (req, res) {

    var userid = mongoose.Types.ObjectId(req.params.userId);
    var role = req.body.requestor.role;

    let validroles = ['Volunteer', 'Manager', 'Administrator', 'Core Team'];

    if(role === "Volunteer" || role === "Manager"){
      validroles = ["Volunteer", "Manager"]
    }


   userhelper.getTeamMembers({_id: userid})
      .then(results => {
        var teammembers = [];

        results.myteam.forEach(element => {

         if(!validroles.includes(element.role)) return;
          
          var member = {};

          let name = (element._id === userid) ? "Self" : `${element.fullName}`;

          member._id = element._id;
          member.role = element.role;
          member.name = name;

          teammembers.push(member);

        });
        res.status(200).send(teammembers);

      })
      .catch(error => res.status(400).send(error));


  }



  return {

    postUserProfile: postUserProfile,
    getUserProfiles: getUserProfiles,
    putUserProfile: putUserProfile,
    getUserById: getUserById,
    getreportees: getreportees
  };

};

module.exports = userProfileController;
