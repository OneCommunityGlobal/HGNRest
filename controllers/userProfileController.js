var userProfileController = function (userProfile) {


  var getUserProfiles = function (req, res) {

    userProfile.find(function (err, profiles) {
      if (err) {
        res.status(404).send("Error finding user profiles");
        return;
      }
      res.json(profiles);
    });

  };
  var postUserProfile = async function (req, res) {

    let _userName = (req.body.userName).toLowerCase();
    let _email = (req.body.email).toLowerCase();

    let userbyusername = await userProfile.findOne({  userName: _userName    });
    let userbyemail = await userProfile.findOne({email: _email});

    if (userbyusername || userbyemail) {
      let errorMessage = "";

      if (userbyusername && userbyemail) {
        errorMessage = "Username and email already exist. Please choose unique values for both.";
      } else {
        if (userbyusername) {
          errorMessage = "Username already exists. Please choose another username.";
        } else {
          errorMessage = "Email already exists. Please choose another email.";

        }
      }
      res.status(400).send({error: errorMessage});
      return;
    }


    var up = new userProfile();
    up.userName = _userName;
    up.password = req.body.password;
    up.role = req.body.role;
    up.firstName = req.body.firstName;
    up.lastName = req.body.lastName;
    up.email = _email;
    up.phoneNumber = req.body.phoneNumber;
    up.bio = req.body.bio;
    up.weeklyComittedHours = req.body.weeklyComittedHours;
    up.professionalLinks = req.body.professionalLinks;
    up.socialLinks = req.body.socialLinks;
    up.otherLinks = req.body.otherLinks;
    up.teamId = req.body.teamId;
    up.createdDate = Date.now();


    up.save()
      .then(function (results) {
        res.status(200).send({_id: up._id}); })
      .catch(error => res.status(501).send(error));


  }

  var putUserProfile = function (req, res) {

    let userid = req.params.userId;



    var isRequestorAuthorized = function () {

     return (req.body.requestor.role === "Administrator" || req.body.requestor.requestorId === userid )? true: false;

    };

    var isRequestorAdmin = function () {
      return (req.body.requestor.role === "Administrator" )? true: false;
    };

    if (!isRequestorAuthorized()) {
      res.status(403).send("You are not authorized to update this user");
      return;
    }


    userProfile.findById(userid,  function (err, record) {

        if (err || record == null) {

          if (record == null) err = " No valid records found";

          res.status(404).send(err);
          return;
        } else {

        
          record.firstName = req.body.firstName;
          record.lastName = req.body.lastName;
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
          record.save()
            .then(function (results) {
              res.status(200).send({
                _id: record._id
              });
            })
            .catch(error => res.status(400).send(error));


        }});

    };


   var getUserById = function (req, res) {

  var userid = req.params.userId;

  var isRequestorAuthorized = function () {
    /* TODO Perform check if logged in user is user himself or an administrator or core team member or manager*/

    let AuthorizedRolesToView = [ 'Manager', 'Administrator', 'Core Team'];
    return (AuthorizedRolesToView.includes(req.body.requestor.role) || req.body.requestor.requestorId === userid )? true: false;

  };

  if (!isRequestorAuthorized()) {
    res.status(403).send("You are not authorized to view this user");
    return;
  }

  userProfile.findById(userid, '-password -lastModifiedDate -createdDate -__v')
  .then(results => res.status(200).send(results))
  .catch(error => res.status(404).send(error))

};

return {

  postUserProfile: postUserProfile,
  getUserProfiles: getUserProfiles,
  putUserProfile: putUserProfile,
  getUserById: getUserById
};
 
};

module.exports = userProfileController;
