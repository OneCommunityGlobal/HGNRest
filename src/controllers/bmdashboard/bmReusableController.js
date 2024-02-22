const mongoose = require('mongoose');
const {
    reusableType: ReusableType
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
                .catch(error => res.status(500).send(error));
        } catch (err) {
            res.json(err);
        }
    };

    const deleteReusable = async (req, res) => {
        const { id } = req.params;

        try {
            const deletedItem = await BuildingReusable.findByIdAndDelete(id);
            if (!deletedItem) {
                return res.status(404).send({ message: 'Item not found.' });
            }
            res.status(200).send({ message: 'Item deleted successfully.', deletedItem });
        } catch (error) {
            console.error('Error deleting the reusable item:', error);
            res.status(500).send(error);
        }
    };

    const addReusable = async (req, res) => {
        try {
            const { itemTypeId, projectId, stockBought, stockAvailable, purchaseRecords, updateRecords, stockDestroyed } = req.body;

            if (!mongoose.Types.ObjectId.isValid(itemTypeId) || !mongoose.Types.ObjectId.isValid(projectId)) {
                return res.status(400).send('Invalid itemTypeId or projectId.');
            }

            const itemType = await ReusableType.findById(itemTypeId);
            if (!itemType || itemType.__t !== 'reusable_type') {
                return res.status(400).send('ItemTypeId does not correspond to a valid reusable_type.');
            }

            if (isNaN(stockBought) || isNaN(stockAvailable) || isNaN(stockDestroyed)) {
                return res.status(400).send('stockBought, stockAvailable, and stockDestroyed must be numbers.');
            }

            if (!Array.isArray(purchaseRecords) || !purchaseRecords.every(record =>
                isValidDate(record.date) &&
                mongoose.Types.ObjectId.isValid(record.requestedBy) &&
                !isNaN(record.quantity) &&
                ['Low', 'Medium', 'High'].includes(record.priority) &&
                ['Approved', 'Pending', 'Rejected'].includes(record.status))) {
                return res.status(400).send('Invalid purchaseRecords array.');
            }

            if (!Array.isArray(updateRecords) || !updateRecords.every(record =>
                isValidDate(record.date) &&
                mongoose.Types.ObjectId.isValid(record.createdBy) &&
                !isNaN(record.quantityUsed) &&
                !isNaN(record.quantityWasted))) {
                return res.status(400).send('Invalid updateRecords array.');
            }

            const purchaseRecord = purchaseRecords.map(record => ({
                date: new Date(record.date),
                requestedBy: record.requestedBy,
                quantity: record.quantity,
                priority: record.priority,
                brandPref: record.brandPref,
                status: record.status,
            }));

            const updateRecord = updateRecords.map(record => ({
                date: new Date(record.date),
                createdBy: record.createdBy,
                quantityUsed: record.quantityUsed,
                quantityWasted: record.quantityWasted,
            }));

            const newReusable = new BuildingReusable({
                itemType: itemTypeId,
                project: projectId,
                stockBought,
                stockAvailable,
                stockDestroyed,
                purchaseRecord,
                updateRecord,
            });

            await newReusable.save();

            res.status(201).send('Reusable record added successfully');
        } catch (error) {
            console.error('Error adding reusable record:', error);
            res.status(500).send('Internal Server Error');
        }
    };

    //TODO(Yan): Delete following line/func after Dev
    async function SeedReusableItems() {
        try {
            const names = [
                'Test Item Six',
            ];
            for (let i = 0; i < names.length; i++) {
                const newReusableType = new ReusableType({
                    __t: 'reusable_type',
                    name: names[i],
                    description: 'Mock item data hard coded by Chengyan to work on reusable list feature',
                    createdBy: '6585fa42c53bf42bc52f237a', //Yan Admin
                });

                const savedItem = await newReusableType.save();
                console.log('Saved itemType ID:', savedItem._id);
            }

        } catch (error) {
            console.error('Error saving the reusable type:', error);
        }
    }

    const purchaseReusable = async (req, res) => {
        const {
            primaryId: projectId,
            secondaryId: itemTypeId,
            quantity,
            priority,
            brandPref,
            requestorId
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
        deleteReusable,
        addReusable,
        purchaseReusable,
        //TODO(Yan): Delete following line/func after Dev
        SeedReusableItems,
    };
};

module.exports = bmReusableController;
