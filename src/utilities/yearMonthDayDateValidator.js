const moment = require('moment-timezone');

const yearMonthDayDateValidator = inputDate => (moment(inputDate, 'YYYY-MM-DD', true).format() !== 'Invalid date');

export default yearMonthDayDateValidator;
