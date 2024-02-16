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

    return {
        fetchBMReusables,
        deleteReusable,
    };
};

module.exports = bmReusableController;
