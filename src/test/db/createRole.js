const Role = require('../../models/role');

const createRole = async (roleName, permissions) => {
    const _role = new Role();

    _role.roleName = roleName;
    _role.permissions = permissions;

    const role = await _role.save();
    return role;
};

module.exports = createRole;