const checkAppAccess = (role) => {
    if (role !== 'Administrator' && role !== 'Owner') {
        return false;
    }
    return true;
}

module.exports = { checkAppAccess };