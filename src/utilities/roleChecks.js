function isEducator(user) {
  return user?.role === 'Educator' || user?.permissions?.includes('educator');
}

function isPM(user) {
  return user?.role === 'Project Manager' || user?.permissions?.includes('manageResourceRequests');
}

module.exports = { isEducator, isPM };
