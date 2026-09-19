const { hasPermission } = require('../../utilities/permissions');

const checkAppAccess = async (requestor) => hasPermission(requestor, 'manageHGNAccessSetup');

module.exports = { checkAppAccess };
