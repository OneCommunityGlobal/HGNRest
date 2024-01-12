const bmConsumableController = function (BuildingConsumable) {
    const fetchBMConsumables = async (req, res) => {
      try {
        BuildingConsumable
          .find()
          .populate([
            {
              path: 'project',
              select: '_id name',
            },
            {
              path: 'itemType',
              select: '_id name unit',
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
          .then(result => {
            res.status(200).send(result);
          })
          .catch(error => res.status(500).send(error));
      } catch (err) {
        res.json(err);
      }
    };
  
    return {
        fetchBMConsumables,
    };
  };
  
module.exports = bmConsumableController;
  