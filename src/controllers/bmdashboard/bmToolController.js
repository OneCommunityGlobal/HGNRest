const bmToolController = (BuildingTool) => {
    const fetchSingleTool = async (req, res) => {
        const { toolId } = req.params;
        try {
            BuildingTool
                .findById(toolId)
                // .populate([
                //     {
                //         path: 'itemType',
                //         select: '_id name description unit imageURL',
                //     },
                //     {
                //         path: 'userResponsible',
                //         select: '_id firstName lastName',
                //     },
                // ])
                .exec()
                .then(tool => res.status(200).send(tool))
                .catch(error => res.status(500).send(error));
        } catch (err) {
            res.json(err);
        }
     };
    return { fetchSingleTool };
};

module.exports = bmToolController;
