const { hasPermission } = require("../utilities/permissions");

const rolePresetsController = function (Preset) {
  const getPresetsByRole = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, "putRole"))) {
      res.status(403).send("You are not authorized to make changes to roles.");
      return;
    }

    const { roleName } = req.params;
    Preset.find({ roleName })
      .then((results) => {
        res.status(200).send(results);
      })
      .catch((error) => {
        res.status(400).send(error);
      });
  };

  const createNewPreset = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, "putRole"))) {
      res.status(403).send("You are not authorized to make changes to roles.");
      return;
    }

    if (!req.body.roleName || !req.body.presetName || !req.body.permissions) {
      res.status(400).send({
        error: "roleName, presetName, and permissions are mandatory fields.",
      });
      return;
    }

    const preset = new Preset();
    preset.roleName = req.body.roleName;
    preset.presetName = req.body.presetName;
    preset.permissions = req.body.permissions;
    preset
      .save()
      .then((result) =>
        res
          .status(201)
          .send({ newPreset: result, message: "New preset created" })
      )
      .catch((error) => res.status(400).send({ error }));
  };

  const updatePresetById = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, "putRole"))) {
      res.status(403).send("You are not authorized to make changes to roles.");
      return;
    }

    const { presetId } = req.params;
    Preset.findById(presetId)
      .then((record) => {
        record.roleName = req.body.roleName;
        record.presetName = req.body.presetName;
        record.permissions = req.body.permissions;
        record
          .save()
          .then((results) => res.status(200).send(results))
          .catch((errors) => res.status(400).send(errors));
      })
      .catch((error) => res.status(400).send({ error }));
  };

  const deletePresetById = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, "putRole"))) {
      res.status(403).send("You are not authorized to make changes to roles.");
      return;
    }

    const { presetId } = req.params;
    Preset.findById(presetId)
      .then((result) => {
        result
          .remove()
          .then(res.status(200).send({ message: "Deleted preset" }))
          .catch((error) => res.status(400).send({ error }));
      })
      .catch((error) => res.status(400).send({ error }));
  };

  return {
    getPresetsByRole,
    createNewPreset,
    updatePresetById,
    deletePresetById,
  };
};

module.exports = rolePresetsController;
