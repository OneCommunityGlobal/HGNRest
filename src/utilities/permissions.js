const Role = require('../models/role');

const hasPermission = async (role, action) => {
  // Permissions depending on the back-end of the
  let isAllowed;
  const allPermissions = await Role.find({});

  const { permissions } = allPermissions.find(({ roleName }) => roleName === role);

  if (permissions.includes(action)) {
    isAllowed = true;
  } else {
    isAllowed = false;
  }
  return isAllowed;
};

module.exports = hasPermission;
