const bmEquipmentController = function (BuildingEquipment) {
  const fetchBMEquipments = async (req, res) => {
    try {
      BuildingEquipment
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
        .then((result) => {
          res.status(200).send(result);
          console.log("Record found");
        })
        .catch(error => res.status(500).send(error));
    } catch (err) {
      res.json(err);
    }
  };

  return {
    fetchBMEquipments,
  };
};

module.exports = bmEquipmentController;
