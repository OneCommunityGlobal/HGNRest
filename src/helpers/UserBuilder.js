const UserProfile = require('../models/userProfile');
const TimeEntry = require('../models/timeentry');
const createUser = require('../test/db/createUser');

const moment = require('moment-timezone');

class UserBuilder {
  /**
 * Default user:
 * 1. Core Team
 * 2. Created 2 weeks ago
 * 3. Weekly committed hours: 10
 * 4. Missed hours: 0
 */
  constructor() {
    this.now = moment.tz('America/Los_Angeles');

    this.data = {
      infringements: [],
      weeklycommittedHours: 10,
      role: 'Core Team',
      missedHours: 0,
      startDate: this.now.clone().subtract(2, 'weeks').toDate(),
      weeklySummaries: []
    };

    return this;
  }

  withRole(role) {
    this.data.role = role;
    return this;
  }

  withCommittedHours(hours) {
    this.data.weeklycommittedHours = hours;
    return this;
  }

  withStartDate(date) {
    this.data.startDate = date;
    return this;
  }

  addInfringement(infr) {
    this.data.infringements.push(infr);
    return this;
  }

  withWeeklySummary(text) {
    this.data.weeklySummaries.push({
      dueDate: this.now.clone().endOf('week').toDate(),
      summary: text,
      uploadDate: this.now.clone().toDate()
    });
    return this;
  }

  override(fields) {
    Object.assign(this.data, fields);
    return this;
  }

  async buildAndSave() {
    // Create fresh user
    const user = await createUser();

    // Apply all builder fields directly to the user instance
    for (const [key, value] of Object.entries(this.data)) {
      user[key] = value;
    }

    await user.save();
    return user;
  }

  /**
   * Build an unsaved user object
   */
  async build() {
    const user = await createUser();
    Object.assign(user, this.data);
    return user;
  }
}

module.exports = UserBuilder;
