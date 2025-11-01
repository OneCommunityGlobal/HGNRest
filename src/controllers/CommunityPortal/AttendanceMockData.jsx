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
  { eventID: 101, eventType: 'WorkShop', eventName: 'Workshops1', date: '01-10-2024', location: 'NY' },
  { eventID: 102, eventType: 'Conference', eventName: 'Conferences1', date: '02-15-2024', location: 'CA' },
  { eventID: 103, eventType: 'Webinar',eventName: 'Webinars1', date: '03-20-2024', location: 'TX' },
  { eventID: 104, eventType: 'WorkShop', eventName: 'Workshops2', date: '01-10-2025', location: 'NY' },
  { eventID: 105, eventType: 'Conference', eventName: 'Conferences2', date: '02-15-2025', location: 'CA' },
  { eventID: 106, eventType: 'Webinar', eventName: 'Webinars2', date: '03-20-2025', location: 'TX' },
  { eventID: 107, eventType: 'Webinar', eventName: 'Webinars3', date: '01-10-2025', location: 'NY' },
  { eventID: 108, eventType: 'WorkShop', eventName: 'Workshops3', date: '02-15-2025', location: 'CA' },
  { eventID: 109, eventType: 'Conference', eventName: 'Conferences3', date: '03-20-2025', location: 'TX' },
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
