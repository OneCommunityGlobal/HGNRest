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
  params: {
    userId: '5a7e21f00317bc1538def4b7',
    teamId: '5a8e21f00317bc',
  },
};

module.exports = mockReq;
