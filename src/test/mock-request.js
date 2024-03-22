const mockReq = {
  body: {
    requestor: {
      role: 'Administrator',
      permissions: {
        frontPermissions: ['addDeleteEditOwners'],
        backPermissions: [],
      },
      requestorId: '65cf6c3706d8ac105827bb2e', // this one matches the id of the db/createUser for testing purposes
    },
  },
};

module.exports = mockReq;
