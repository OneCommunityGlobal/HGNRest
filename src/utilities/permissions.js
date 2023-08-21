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

const canRequestorUpdateUser = (requestorId, userId) => {
  const allowedIds = ['63feae337186de1898fa8f51', // dev jae@onecommunityglobal.org
                      '5baac381e16814009017678c', // dev one.community@me.com
                      '63fe855b7186de1898fa8ab7', // dev jsabol@me.com
                      '64deba9064131f13540ac23b', // main jae@onecommunityglobal.org
                      '610d5ae67002ae3fecdf7080', // main one.community@me.com
                      '63fe8e4fa79c5619d0b5a563', // main jsabol@me.com
                    ];
  const protectedIds = ['63feae337186de1898fa8f51', // dev jae@onecommunityglobal.org
                        '5baac381e16814009017678c', // dev one.community@me.com
                        '63fe855b7186de1898fa8ab7', // dev jsabol@me.com
                        '64deba9064131f13540ac23b', // main jae@onecommunityglobal.org
                        '610d5ae67002ae3fecdf7080', // main one.community@me.com
                        '63fe8e4fa79c5619d0b5a563', // main jsabol@me.com
                        '64c17eb8c737b05dd4ac4e28', // dev devadmin@hgn.net
                      ];
  return !(protectedIds.includes(userId) && !allowedIds.includes(requestorId));
};

module.exports = { hasPermission, canRequestorUpdateUser };
