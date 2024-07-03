function mockUser() {
  const up = {};

  up.password = 'SuperSecretPassword@';
  up.role = 'any_role';
  up.firstName = 'any_first_name';
  up.lastName = 'any_last_name';
  up.jobTitle = ['any_job_title'];
  up.phoneNumber = ['123456789'];
  up.bio = 'any_bio';
  up.weeklycommittedHours = 21;
  up.weeklycommittedHoursHistory = [
    {
      hours: up.weeklycommittedHours,
      dateChanged: 123,
    },
  ];
  up.personalLinks = [];
  up.adminLinks = [];
  up.teams = [];
  up.projects = [];
  up.createdDate = '2024-02-14T05:00:00.000Z';
  up.email = 'dominicsc2hs@gmail.com';
  up.weeklySummaries = [{ summary: '' }];
  up.weeklySummariesCount = 0;
  up.weeklySummaryOption = 'Required';
  up.mediaUrl = '';
  up.collaborationPreference = '';
  up.timeZone = 'America/Los_Angeles';
  up.location = {
    userProvided: '',
    coords: {
      lat: null,
      lng: null,
    },
    country: '',
    city: '',
  };
  up.permissions = {
    backPermissions: [],
    frontPermissions: [],
  };
  up.bioPosted = 'default';
  up.isFirstTimelog = true;
  up.actualEmail = '';
  up.isVisible = true;

  return up;
}

module.exports = mockUser;
