
const rolesController = function (Role) {
  const getAllRoles = function (req, res) {
    Role.find({})
    .then(results => res.status(200).send(results))
    .catch(error => res.status(404).send({ error }));
  };

  const createNewRole = function (req, res) {
    if (req.body.requestor.role !== 'Owner') {
      res.status(403).send({ error: 'You are not authorized to create a new role. Must be a Owner.' });
    }

    if (!req.body.roleName || !req.body.permissions) {
      res.status(400).send({ error: 'roleName and permissions are mandatory fields.' });
    }

    const role = new Role();
    role.roleName = req.body.roleName;
    role.permissions = req.body.permissions;

    role.save().then(results => res.status(201).send(results)).catch(err => res.status(500).send({ err }));
  };

  const getRoleById = function (req, res) {
      const { roleId } = req.params;
      Role.findById(
        roleId,
      )
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send({ error }));
};


  const updateRoleById = function (req, res) {
    if (req.body.requestor.role !== 'Owner') {
      res.status(403).send('You are not authorized to make changes in the roles.');
    }

    const { roleId } = req.params;

    if (!req.body.permissions) {
      return res.status(400).send({ error: 'Permissions is a mandatory field' });
  }

    return Role.findById(roleId, (error, record) => {
      if (error || record === null) {
        res.status(400).send('No valid records found');
        return;
      }
      record.permissions = req.body.permissions;

      record.save()
        .then(results => res.status(201).send(results))
        .catch(errors => res.status(400).send(errors));
    });
  };

  const deleteRoleById = function (req, res) {
    const { roleId } = req.params;
    if (req.body.requestor.role !== 'Owner') {
      res.status(403).send('You are not authorized to make changes in the roles.');
    }
    Role.findById(roleId)
      .then((result) => {
        result
          .remove()
          .then(res.status(200).send({ message: 'Deleted role' }))
          .catch((error) => {
            res.status(400).send(error);
          });
      })
      .catch((error) => {
        res.status(400).send(error);
      });
  };


  return {
    getAllRoles,
    createNewRole,
    getRoleById,
    updateRoleById,
    deleteRoleById,
  };
};

module.exports = rolesController;
