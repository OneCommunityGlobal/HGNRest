const UserProfile = require('../models/userProfile');
// const cacheClosure = require('../utilities/nodeCache');
const { hasPermission } = require('../utilities/permissions');

const rolesController = function (Role) {
  // const cache = cacheClosure();
  const getAllRoles = function (req, res) {
    Role.find({})
      .then((results) => res.status(200).send(results))
      .catch((error) => res.status(404).send({ error }));
  };

  const createNewRole = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'postRole'))) {
      res.status(403).send('You are not authorized to create new roles.');
      return;
    }

    if (!req.body.roleName || !req.body.permissions) {
      res.status(400).send({ error: 'roleName and permissions are mandatory fields.' });
      return;
    }

    const role = new Role();
    role.roleName = req.body.roleName;
    role.permissions = req.body.permissions;
    role.permissionsBackEnd = req.body.permissionsBackEnd;

    role
      .save()
      .then((results) => res.status(201).send(results))
      .catch((err) => res.status(500).send({ err }));
  };

  const getRoleById = function (req, res) {
    const { roleId } = req.params;
    Role.findById(roleId)
      .then((results) => res.status(200).send(results))
      .catch((error) => res.status(404).send({ error }));
  };

  const updateRoleById = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'putRole'))) {
      res.status(403).send('You are not authorized to make changes to roles.');
      return;
    }

    const { roleId } = req.params;

    if (!req.body.permissions) {
      res.status(400).send({ error: 'Permissions is a mandatory field' });
      return;
    }

    Role.findById(roleId, (error, record) => {
      if (error || record === null) {
        res.status(400).send('No valid records found');
        return;
      }

      record.roleName = req.body.roleName;
      record.permissions = req.body.permissions;
      record.permissionsBackEnd = req.body.permissionsBackEnd;

      record
        .save()
        .then((results) => res.status(201).send(results))
        .catch((errors) => res.status(400).send(errors));
    });
  };

  const deleteRoleById = async function (req, res) {
    if (!(await hasPermission(req.body.requestor, 'deleteRole'))) {
      return res.status(403).send('You are not authorized to delete roles.');
    }

    const { roleId } = req.params;

    try {
      const role = await Role.findById(roleId);
      if (!role) {
        return res.status(404).send({ error: 'Role not found' });
      }

      const roleToDelete = role.roleName;
      await Role.deleteOne({ _id: roleId });
      await UserProfile.updateMany({ role: roleToDelete }, { $set: { role: 'Volunteer' } });

      return res.status(200).send({
        message: `Deleted role "${roleToDelete}" and reassigned affected users to Volunteer`,
      });
    } catch (error) {
      console.error('Error deleting role:', error);
      return res.status(500).send({ error: 'Failed to delete role' });
    }
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
