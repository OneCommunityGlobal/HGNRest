const mongoose = require('mongoose');
const {
    reusableType: ReusableType,
} = require('../../models/bmdashboard/buildingInventoryType');

function isValidDate(dateString) {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
}

const bmReusableController = function (BuildingReusable) {
    const fetchBMReusables = async (req, res) => {
        try {
            BuildingReusable
                .find()
                .populate([
                    {
                        path: 'project',
                        select: '_id name',
                    },
                    {
                        path: 'itemType',
                        select: '_id name',
                    },
                    {
                        path: 'updateRecord',
                        populate: {
                            path: 'createdBy',
                            select: '_id firstName lastName',
                        },
                    },
                    {
                        path: 'purchaseRecord',
                        populate: {
                            path: 'requestedBy',
                            select: '_id firstName lastName',
                        },
                    },
                ])
                .exec()
                .then((result) => {
                    res.status(200).send(result);
                })
                .catch((error) => res.status(500).send(error));
        } catch (err) {
            res.json(err);
        }
    };

    const purchaseReusable = async (req, res) => {
        const {
            primaryId: projectId,
            secondaryId: itemTypeId,
            quantity,
            priority,
            brand: brandPref,
            requestor: { requestorId },
        } = req.body;

        try {
            if (!mongoose.Types.ObjectId.isValid(itemTypeId) || !mongoose.Types.ObjectId.isValid(projectId)) {
                return res.status(400).send('Invalid itemTypeId or projectId.');
            }

            const itemType = await ReusableType.findById(itemTypeId);
            if (!itemType || itemType.__t !== 'reusable_type') {
                return res.status(400).send('ItemTypeId does not correspond to a valid reusable_type.');
            }

            const allowedPriorities = ['Low', 'Medium', 'High'];
            if (!allowedPriorities.includes(priority)) {
              return res.status(400).send('Invalid priority. Must be one of: Low, Medium, High.');
            }

            const newPurchaseRecord = {
                date: new Date(),
                requestedBy: requestorId,
                quantity,
                priority,
                brandPref,
            };

            const doc = await BuildingReusable.findOne({ project: projectId, itemType: itemTypeId });

            if (!doc) {
                const newDoc = new BuildingReusable({
                    itemType: itemTypeId,
                    project: projectId,
                    purchaseRecord: [newPurchaseRecord],
                });
                await newDoc.save();
                res.status(201).send('New reusable purchase record created successfully');
            } else {
                await BuildingReusable.findByIdAndUpdate(
                    { _id: mongoose.Types.ObjectId(doc._id) },
                    { $push: { purchaseRecord: newPurchaseRecord } },
                );
                res.status(201).send('Reusable purchase record updated successfully');
            }
        } catch (error) {
            console.error('Error processing reusable purchase:', error);
            res.status(500).send('Internal Server Error');
        }
    };

    return {
        fetchBMReusables,
        purchaseReusable,
    };
};

module.exports = bmReusableController;
