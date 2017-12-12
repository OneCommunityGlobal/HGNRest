var userProfileController = function (userProfile) {


  var getUserProfiles = function (req, res) {

    userProfile.find(function (err, profiles) {
      if (err) res.status(404).send("Error finding user profiles");
      res.json(profiles);
    })

  };
  var postUserProfile = function (req, res) {

    var up = new userProfile();
    up.userName = req.body.userName;
    up.password = req.body.password;
    up.role = req.body.role;
    up.firstName = req.body.firstName;
    up.lastName = req.body.lastName;
    up.email = req.body.email;
    up.phoneNumber = req.body.phoneNumber;
    up.bio = req.body.bio;
    up.weeklyComittedHours = req.body.weeklyComittedHours;
    up.professionalLinks = req.body.professionalLinks;
    up.socialLinks = req.body.socialLinks;
    up.otherLinks = req.body.otherLinks;
    up.TeamId = req.body.TeamId;    
    up.createdDate = Date.now();

    up.save(function (err) {

      if (err) {
        res.status(500).send(err);

      } else {
        res.status(201).send("Profile saved. Id is " + up._id);
      }

    });
  };

  var putUserProfile = function (req, res) {

    userid = req.params.userId;



    var isRequestorAuthorized = function () {
      /* TODO Perform check if logged in user is user himself or an administrator*/
      return true;

    };

    var isRequestorAdmin = function () {
      /* TODO Perform check if logged in user  administrator so that updates to admin speific fields ca be handled*/
      return true;
    }

    if (!isRequestorAuthorized()) {
      res.status(403).send("You are not authorized to update this user");
    }


   userProfile.findById(userid, function (err, record) {

      if (err || record ==null) {

        if (record == null) err = " No valid records found";

        res.status(404).send(err );
      }
      
      else{

       record.password = req.body.password;
        record.firstName = req.body.firstName;
        record.lastName = req.body.lastName;
        record.email = req.body.email;
        record.phoneNumber = req.body.phoneNumber;
        record.bio = req.body.bio;
        record.professionalLinks = req.body.professionalLinks;
        record.socialLinks = req.body.socialLinks;
        record.lastModifiedDate = Date.now();


        if (isRequestorAdmin()) {
          record.role = req.body.role;
          record.weeklyComittedHours = req.body.weeklyComittedHours;
          record.otherLinks = req.body.otherLinks;
          record.TeamId = req.body.TeamId;
        }
        record.save(function (err) {

          if (err) {
            res.status(501).send(err);
          } else 
          {
            res.status(200).send("Profile Successfully updated as " + record);
          }

        })
      }

      

    })

  };

  var getUserById = function (req, res) {

    var userid = req.params.userId;

    var isRequestorAuthorized = function () {
      /* TODO Perform check if logged in user is user himself or an administrator or core team member or manager*/
      return true;

    };

    if (!isRequestorAuthorized()) {
      res.status(403).send("You are not authorized to view this user");
    }


    userProfile.findById(userid, function (err, record) {
      if (err) {
        res.status(404).send("Error finding user")
      } else {
        res.send(record).status(200);
      }
    });

  }

  return {

    postUserProfile: postUserProfile,
    getUserProfiles: getUserProfiles,
    putUserProfile: putUserProfile,
    getUserById: getUserById
  }

}

module.exports = userProfileController;
