const mongoose = require("mongoose");
const userProfile = require("../models/userProfile");
const currentWarningsController = function (currentWarnings) {
  const getCurrentWarnings = async (req, res) => {
    try {
      const response = await currentWarnings.find({});
      if (response.length === 0) {
        return res.status(400).send({ message: "no valid records" });
      }
      return res.status(201).send({ currentWarningDescriptions: response });
    } catch (error) {
      console.log("error", error);
    }
  };

  const postNewWarningDescription = async (req, res) => {
    //post to the db using mongodb methods
    //search a method to post id will be generated
    try {
      const { newWarning, activeWarning } = req.body;

      const warnings = await currentWarnings.find({});

      if (warnings.length === 0) {
        return res.status(400).send({ message: "no valid records" });
      }

      const newWarningDescription = new currentWarnings();
      newWarningDescription.warningTitle = newWarning;
      newWarningDescription.activeWarning = activeWarning;

      warnings.push(newWarningDescription);
      await newWarningDescription.save();

      return res.status(201).send({ newWarnings: warnings });
    } catch (err) {
      console.log("error", err);
    }
  };

  const updateWarningDescription = async (req, res) => {
    try {
      const { warningDescriptionId } = req.params;

      const response = await currentWarnings.findOneAndUpdate(
        { _id: warningDescriptionId },
        [{ $set: { activeWarning: { $not: "$activeWarning" } } }],
        { new: true }
      );

      // console.log("response", response);
      const updatedWarningDescription = {
        _id: response._id,
        activeWarning: response.activeWarning,
      };

      res.status(201).send(updatedWarningDescription);
    } catch (err) {
      console.log("error", err);
    }
  };

  //delete will delete the  warning and all warnings assocaited with it
  const deleteWarningDescription = async (req, res) => {
    try {
      //   if (!await hasPermission(req.body.requestor, 'deleteRole')) {
      //     res.status(403).send('You are not authorized to delete roles.');
      //     return;
      //   }

      //   const { roleId } = req.params;
      //   Role.findById(roleId)
      //     .then(result => (
      //       result
      //         .remove()
      //         .then(UserProfile
      //           .updateMany({ role: result.roleName }, { role: 'Volunteer' })
      //           .then(() => {
      //             const isUserInCache = cache.hasCache('allusers');
      //             if (isUserInCache) {
      //               const allUserData = JSON.parse(cache.getCache('allusers'));
      //               allUserData.forEach((user) => {
      //                 if (user.role === result.roleName) {
      //                   user.role = 'Volunteer';
      //                   cache.removeCache(`user-${user._id}`);
      //                 }
      //               });
      //               cache.setCache('allusers', JSON.stringify(allUserData));
      //             }
      //             res.status(200).send({ message: 'Deleted role' });
      //           })
      //           .catch(error => res.status(400).send({ error })))
      //         .catch(error => res.status(400).send({ error }))
      //     ))
      //     .catch(error => res.status(400).send({ error }));
      // };
      // if (!(await hasPermission(req.body.requestor, 'deleteBadges'))) {
      //   res
      //     .status(403)
      //     .send({ error: 'You are not authorized to delete badges.' });
      //   return;
      // }
      // const { badgeId } = req.params;
      // Badge.findById(badgeId, (error, record) => {
      //   if (error || record === null) {
      //     res.status(400).send({ error: 'No valid records found' });
      //     return;
      //   }
      //   const removeBadgeFromProfile = UserProfile.updateMany(
      //     {},
      //     { $pull: { badgeCollection: { badge: record._id } } },
      //   ).exec();
      //   const deleteRecord = record.remove();

      //   Promise.all([removeBadgeFromProfile, deleteRecord])
      //     .then(
      //       res.status(200).send({
      //         message: 'Badge successfully deleted and user profiles updated',
      //       }),
      //     )
      //     .catch((errors) => {
      //       res.status(500).send(errors);
      //     });
      // const { MongoClient } = require('mongodb');

      // async function deleteAndReturnDocument(client, dbName, collectionName, filter) {
      //     const db = client.db(dbName);
      //     const collection = db.collection(collectionName);

      //     try {
      //         // Find the document to be deleted
      //         const documentToDelete = await collection.findOne(filter);

      //         // Delete the document
      //         const result = await collection.deleteOne(filter);
      //         console.log(`Deleted ${result.deletedCount} document.`);

      //         // Return the deleted document
      //         return documentToDelete;
      //     } catch (error) {
      //         console.error('Error deleting document:', error);
      //         return null;
      //     }
      // }

      // async function main() {
      //     const uri = 'mongodb://localhost:27017';
      //     const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

      //     try {
      //         await client.connect();

      //         const dbName = 'myDatabase';
      //         const collectionName = 'myCollection';
      //         const filter = { _id: 'someDocumentId' };

      //         const deletedDocument = await deleteAndReturnDocument(client, dbName, collectionName, filter);
      //         console.log('Deleted document:', deletedDocument);
      //     } finally {
      //         await client.close();
      //     }
      // }

      // main().catch(console.error);

      //find the document to be dleted via the id
      //then delte the document
      //then itertate through all the usres' descritpions and delete the warning

      const { warningDescriptionId } = req.params;
      console.log("warningDescriptionId", warningDescriptionId);
      // Find the document to be deleted
      const documentToDelete = await currentWarnings.findById(
        warningDescriptionId
      );

      await currentWarnings.deleteOne({
        _id: mongoose.Types.ObjectId(warningDescriptionId),
      });

      console.log("document to delete", documentToDelete);
      const deletedDescription = documentToDelete.warningTitle;

      await userProfile
        .updateMany(
          {
            "warnings.description": deletedDescription,
          },
          {
            $pull: {
              warnings: { description: deletedDescription },
            },
          }
        )
        .then((response) => console.log("res", response));

      // UserProfile.updateMany(
      // will delete all corresponding warnings on each user
      //new feature and needs to incorpoarted

      // console.log("response", response);

      //don't send the response back
      //i couild but i have the id on the frontend already so i filter from that
      //sends back the updated reponse
      //on the frontend i'll return a new array with the updated paramter
      //then add a grey coloring to the text and a new button of + to re add it
      //will need another route to conenct it
      //can be an update route
      res.status(200).send({
        message:
          "warning description was successfully deleted and user profiles updated",
      });
    } catch (err) {
      console.log("error", err);
    }
  };

  return {
    getCurrentWarnings,
    postNewWarningDescription,
    updateWarningDescription,
    deleteWarningDescription,
  };
};
module.exports = currentWarningsController;
