// Mock data for Participants
const participants = [
  { participantID: 1, name: 'Alice', age: 25, gender: 'Female', location: 'NY' },
  { participantID: 2, name: 'Bob', age: 30, gender: 'Male', location: 'CA' },
  { participantID: 3, name: 'Charlie', age: 28, gender: 'Non-binary', location: 'TX' },
  { participantID: 4, name: 'David', age: 35, gender: 'Male', location: 'NY' },
  { participantID: 5, name: 'Eve', age: 22, gender: 'Female', location: 'CA' },
  { participantID: 6, name: 'Frank', age: 40, gender: 'Male', location: 'TX' },
  { participantID: 7, name: 'Grace', age: 29, gender: 'Female', location: 'NY' },
];

// Mock data for Events
const events = [
  { 
    eventID: 101, 
    eventType: 'Workshop', 
    eventName: 'React Basics Workshop', 
    date: '2025-01-27', 
    time: '10:00 AM',
    location: 'Virtual', 
    maxAttendees: 3,
    description: 'A beginner-friendly workshop covering components, props, and state.' 
  },
  { 
    eventID: 102, 
    eventType: 'Conference', 
    eventName: 'Tech Innovators Conf', 
    date: '2025-01-15', 
    time: '09:00 AM',
    location: 'CA', 
    maxAttendees: 5,
    description: 'Annual conference for technology enthusiasts and innovators.' 
  },
  { 
    eventID: 103, 
    eventType: 'Webinar',
    eventName: 'AI in Healthcare', 
    date: '2025-01-20', 
    time: '02:00 PM',
    location: 'TX', 
    maxAttendees: 50,
    description: 'Discussing the future of Artificial Intelligence in modern medicine.' 
  },
  { 
    eventID: 104, 
    eventType: 'Social Gathering', 
    eventName: 'Community Meetup', 
    date: '2025-01-30', 
    time: '06:00 PM',
    location: 'NY', 
    maxAttendees: 20,
    description: 'Casual networking event for local community members.' 
  },
  { 
    eventID: 105, 
    eventType: 'Workshop', 
    eventName: 'Advanced Node.js', 
    date: '2025-02-10', 
    time: '11:00 AM',
    location: 'Virtual', 
    maxAttendees: 10, 
    description: 'Deep dive into streams, buffers, and performance optimization.' 
  }
];


// Mock data for Attendance
const attendance = [
  { attendanceID: 1001, eventID: 101, participantID: 1, checkInTime: '09:00 AM', attended: true },
  { attendanceID: 1001, eventID: 105, participantID: 1, checkInTime: '09:00 AM', attended: true },
  { attendanceID: 1002, eventID: 101, participantID: 2, checkInTime: '09:30 AM', attended: false },
  { attendanceID: 1003, eventID: 102, participantID: 3, checkInTime: '10:00 AM', attended: true },
  { attendanceID: 1004, eventID: 103, participantID: 4, checkInTime: '10:30 AM', attended: true },
  { attendanceID: 1005, eventID: 104, participantID: 5, checkInTime: '11:00 AM', attended: false },
  { attendanceID: 1006, eventID: 106, participantID: 6, checkInTime: '11:30 AM', attended: true },
  { attendanceID: 1007, eventID: 106, participantID: 7, checkInTime: '12:00 PM', attended: false },
  { attendanceID: 1002, eventID: 101, participantID: 2, checkInTime: '09:30 AM', attended: false },
  { attendanceID: 1003, eventID: 106, participantID: 3, checkInTime: '10:00 AM', attended: false },
  { attendanceID: 1004, eventID: 103, participantID: 4, checkInTime: '10:30 AM', attended: true },
  { attendanceID: 1005, eventID: 104, participantID: 5, checkInTime: '11:00 AM', attended: false },
  { attendanceID: 1006, eventID: 105, participantID: 6, checkInTime: '11:30 AM', attended: true },
  { attendanceID: 1007, eventID: 102, participantID: 7, checkInTime: '12:00 PM', attended: false },
  { attendanceID: 1002, eventID: 101, participantID: 2, checkInTime: '09:30 AM', attended: false },
  { attendanceID: 1003, eventID: 104, participantID: 3, checkInTime: '10:00 AM', attended: false },
  { attendanceID: 1004, eventID: 103, participantID: 4, checkInTime: '10:30 AM', attended: true },
  { attendanceID: 1005, eventID: 104, participantID: 5, checkInTime: '11:00 AM', attended: false },
  { attendanceID: 1006, eventID: 107, participantID: 6, checkInTime: '11:30 AM', attended: false },
  { attendanceID: 1007, eventID: 108, participantID: 7, checkInTime: '12:00 PM', attended: false },
  { attendanceID: 1003, eventID: 108, participantID: 3, checkInTime: '10:00 AM', attended: false },
  { attendanceID: 1004, eventID: 109, participantID: 4, checkInTime: '10:30 AM', attended: true },
  { attendanceID: 1005, eventID: 109, participantID: 5, checkInTime: '11:00 AM', attended: false },
  { attendanceID: 1006, eventID: 107, participantID: 6, checkInTime: '11:30 AM', attended: true },
  { attendanceID: 1007, eventID: 107, participantID: 7, checkInTime: '12:00 PM', attended: false },
];

// export { participants, events, attendance };
module.exports = { participants, events, attendance };
