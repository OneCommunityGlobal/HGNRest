const permissionController = function (Permission) {
    const createNewPermission = function (req, res) {
      if (!req.body.permissionName || !req.body.description) {
        res.status(400).send({ error: 'permissionName and description are mandatory fields.' });
        return;
      }

      const permission = new Permission();
      permission.permissionName = req.body.permissionName;
      permission.description = req.body.description;

      permission.save()
      .then(results => res.status(201).send(results))
      .catch(err => res.status(500).send({ err }));
    };

    const getAllPermissions = function (req, res) {
        Permission.find({})
        .then(results => res.status(200).send(results))
        .catch(error => res.status(404).send({ error }));
    };

    const deletePermission = function (req, res) {
        Permission.findById(req.params.permissionId)
        .then((result) => {
            result.remove()
            .then(res.status(200).send({ message: 'Deleted permission' }))
            .catch(error => res.status(400).send({ error }));
        });
    };

    return {
      getAllPermissions,
      createNewPermission,
      deletePermission,
    };
  };

  module.exports = permissionController;
