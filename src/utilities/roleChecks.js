function isEducator(user) {
  return user?.role === 'Educator' || user?.permissions?.includes('createResourceRequests');
}

function isPM(user) {
  return (
    user?.role === 'Program Manager' ||
    user?.role === 'Owner' ||
    user?.role === 'Administrator' ||
    user?.permissions?.includes('manageResourceRequests')
  );
}

module.exports = { isEducator, isPM };
