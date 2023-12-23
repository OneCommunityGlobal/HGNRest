const bmInventoryUnitController = function (InvUnit) {
    const fetchInvUnits = async (req, res) => {
      try {
        InvUnit
          .find()
          .exec()
          .then(result => res.status(200).send(result))
          .catch(error => res.status(500).send(error));
      } catch (err) {
        res.json(err);
      }
    };
  
    const addBuildingInventoryUnit = async function _matTypeList(req, res) {
      try {
        const inventoryUnitObject = new InvUnit();
        inventoryUnitObject.description = req.body.description;
        inventoryUnitObject.unit =  req.body.unit;
        inventoryUnitObject.save()
        .then(results => res.status(201).send(results))
        .catch(errors => res.status(500).send(errors));
      } catch (err) {
        res.json(err);
      }
    };
    return { fetchInvUnits , addBuildingInventoryUnit };
  };
  
  module.exports = bmInventoryUnitController;
  