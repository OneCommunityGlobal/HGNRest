module.exports = {
  studentGroups: [
    { groupId: 'g1', groupName: 'Group Alpha' },
    { groupId: 'g2', groupName: 'Group Beta' },
  ],

  studentGroupMembers: [
    { studentId: 's1', groupId: 'g1' },
    { studentId: 's2', groupId: 'g1' },
    { studentId: 's3', groupId: 'g2' },
  ],

  educationStudentProfile: [
    {
      studentId: 's1',
      progressSummary: {
        totalCompleted: 50,
        totalInProgress: 20,
        totalNotStarted: 30,
        totalAtoms: 100,
      },
      subjects: [
        { name: 'Math', molecules: [{ name: 'Algebra', grade: 'A' }] },
        { name: 'Science', molecules: [{ name: 'Chemistry', grade: 'B' }] },
      ],
      educator: 'Alice',
    },
    {
      studentId: 's2',
      progressSummary: {
        totalCompleted: 30,
        totalInProgress: 50,
        totalNotStarted: 20,
        totalAtoms: 100,
      },
      subjects: [],
      educator: 'Bob',
    },
    {
      studentId: 's3',
      progressSummary: {
        totalCompleted: 70,
        totalInProgress: 20,
        totalNotStarted: 10,
        totalAtoms: 100,
      },
      subjects: [],
      educator: 'Charlie',
    },
  ],

  studentMetrics: {
    s1: {
      averageScore: 92,
      engagementRate: 80,
      completionRate: 85,
    },
    s2: {
      averageScore: 75,
      engagementRate: 60,
      completionRate: 70,
    },
    s3: {
      averageScore: 88,
      engagementRate: 90,
      completionRate: 95,
    },
  },
};
