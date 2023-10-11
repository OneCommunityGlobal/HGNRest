const UserProfile = require('../models/userProfile');

const isEmailExistsController = function () {

  const isEmailExists = async function (req, res) {

    try { 
      const userProfile = await UserProfile.findOne({ email: req.params.email }).lean().exec()

      if (userProfile) {
        res.status(200).send(`Email, ${userProfile.email}, found.`)
      } else {
        res.status(403).send(`Email, ${req.params.email}, not found.`)
      }
    } catch (err) {
      console.log(err)
    }
  }

  return {
    isEmailExists
  }
}

module.exports = isEmailExistsController
