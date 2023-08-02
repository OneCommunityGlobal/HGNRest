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

const canRequestorUpdateUser = (requestorId, userId) => !(
  userId === '64c17eb8c737b05dd4ac4e28' // 'devadmin@hgn.net'
    && (
      requestorId !== '63feae337186de1898fa8f51' // 'jae@onecommunityglobal.org'
    )
);

module.exports = { hasPermission, canRequestorUpdateUser };
