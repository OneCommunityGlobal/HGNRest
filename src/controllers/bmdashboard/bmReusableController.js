const mongoose = require('mongoose');
const {
    reusableType: ReusableType
} = require('../../models/bmdashboard/buildingInventoryType');

function isValidDate(dateString) {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
}

const bmReusableController = function (BuildingReusable,) {
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
    

    return {
        fetchBMReusables,
    };
};

module.exports = bmReusableController;
