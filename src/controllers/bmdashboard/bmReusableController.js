// TDOD(Yan): delete the ReusableType obj
const bmReusableController = function (BuildingReusable, ReusableType) {
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

    // TODO(Yan): Seed function should be deleted after dev
    const seed = async (req, res) => {
        const savedIds = [];
        try {
            await SeedReusableItems(savedIds);

            // Building IDs
            const buildings = [
                '65419e61105441587e2dec99', // Building 1
                '654946b2bc5772e8caf7e962', // Building 2
                '654946c8bc5772e8caf7e963', // Building 3
            ];

            // Assign itemTypes to buildings: 3 to Building 1, 3 to Building 2, 4 to Building 3
            const buildingAssignment = [3, 3, 4];

            let currentIndex = 0;
            for (let i = 0; i < buildings.length; i++) {
                for (let j = 0; j < buildingAssignment[i]; j++) {
                    const newReusable = new BuildingReusable({
                        itemType: savedIds[currentIndex],
                        project: buildings[i],
                        stockBought: 100,
                        stockAvailable: 83,
                        purchaseRecord: [{
                            date: new Date('2024-01-20'),
                            requestedBy: '6585fa42c53bf42bc52f237a', // Yan Admin
                            quantity: 100,
                            priority: 'High',
                            brandPref: '3M',
                            status: 'Approved',
                        }],
                        updateRecord: [{
                            date: new Date('2024-01-25'),
                            createdBy: '6585fa42c53bf42bc52f237a', // Yan Admin
                            quantityUsed: 0,
                            quantityWasted: 17,
                        }],
                    });
                    await newReusable.save(); // Save each BuildingReusable
                    console.log(`Reusable item saved successfully for building ${buildings[i]}`);
                    currentIndex++; // Move to the next itemType ID for the next item
                }
            }
        } catch (error) {
            console.error('Error seeding reusable items:', error);
            res.status(500).send(error);
        }
    };

    // TODO(Yan): SeedReusableItems function should be deleted after dev
    async function SeedReusableItems(savedIds) {
        try {
            const names = [
                'Sky Protector',
                'Hard Hat Hero',
                'Vertex Shield',
                'Summit Guardian',
                'Eagle Eye Helmet',
                'Pinnacle Defender',
                'Peak Cap',
                'Horizon Helmet',
                'Terra Tuff',
                'Boulder Brain Bucket',
            ];
            for (let i = 0; i < names.length; i++) {
                const newReusableType = new ReusableType({
                    __t: 'reusable_type',
                    name: names[i],
                    description: 'Mock data hard coded by Chengyan to work on reusable list feature',
                    createdBy: '6585fa42c53bf42bc52f237a',
                });

                const savedItem = await newReusableType.save();
                savedIds.push(savedItem._id);
            }

            console.log('Saved itemType IDs:', savedIds);
        } catch (error) {
            console.error('Error saving the reusable type:', error);
        }
    }
    // TODO(Yan): CleanupReusableItems function should be deleted after dev
    async function cleanupReusableItems() {
        try {
            const reusableTypeCriteria = {
                createdBy: '6585fa42c53bf42bc52f237a',
                __t: 'reusable_type',
            };

            const reusableTypeDeletionResult = await ReusableType.deleteMany(reusableTypeCriteria);
            console.log(`Deleted ${reusableTypeDeletionResult.deletedCount} reusable types.`);

            const buildingReusableCriteria = {
                __t: 'reusable_item',
            };

            const buildingReusableDeletionResult = await BuildingReusable.deleteMany(buildingReusableCriteria);
            console.log(`Deleted ${buildingReusableDeletionResult.deletedCount} building reusables.`);
        } catch (error) {
            console.error('Error cleaning up the reusable items:', error);
        }
    }

    // TODO(Yan): seed and CleanupReusableItems function should be deleted after dev
    return {
        fetchBMReusables,
        deleteReusable,
        seed,
        cleanupReusableItems,
    };
};

module.exports = bmReusableController;
