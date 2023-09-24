const UserProfile = require('../models/userProfile');
const cache = require('../utilities/nodeCache')();
const { hasPermission } = require('../utilities/permissions');

const rolesController = function (Role) {
  const getAllRoles = function (req, res) {
    Role.find({})
    .then(results => res.status(200).send(results))
    .catch(error => res.status(404).send({ error }));
  };

  const createNewRole = async function (req, res) {
    if (
      !(await hasPermission(req.body.requestor.role, "postRole")) &&
      !req.body.requestor.permissions?.frontPermissions.includes("postRole")
    ) {
      res.status(403).send("You are not authorized to create new roles.");
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


  const updateRoleById = async function (req, res) {
    if (!await hasPermission(req.body.requestor.role, 'putRole')) {
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

      record.save()
        .then(results => res.status(201).send(results))
        .catch(errors => res.status(400).send(errors));
    });
  };

  const deleteRoleById = async function (req, res) {
    if (!await hasPermission(req.body.requestor.role, 'deleteRole')) {
      res.status(403).send('You are not authorized to delete roles.');
      return;
    }

    const { roleId } = req.params;
    Role.findById(roleId)
      .then(result => (
        result
          .remove()
          .then(UserProfile
            .updateMany({ role: result.roleName }, { role: 'Volunteer' })
            .then(() => {
              const isUserInCache = cache.hasCache('allusers');
              if (isUserInCache) {
                const allUserData = JSON.parse(cache.getCache('allusers'));
                allUserData.forEach((user) => {
                  if (user.role === result.roleName) {
                    user.role = 'Volunteer';
                    cache.removeCache(`user-${user._id}`);
                  }
                });
                cache.setCache('allusers', JSON.stringify(allUserData));
              }
              res.status(200).send({ message: 'Deleted role' });
            })
            .catch(error => res.status(400).send({ error })))
          .catch(error => res.status(400).send({ error }))
      ))
      .catch(error => res.status(400).send({ error }));
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
