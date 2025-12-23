const TimeEntry = require('../../models/timeentry');

class TimeEntryBuilder {
    constructor() {
        this.data = [];
        return this;
    }
    addEntry(userId, dateOfWork, totalHours, isTangible = true, entryType = 'task') {
        this.data.push({
            personId: userId,
            dateOfWork: dateOfWork,
            isTangible: isTangible,
            entryType: entryType,
            totalSeconds: totalHours * 3600,
            createdDateTime: new Date(),
            isActive: true,
        });
        return this;
    }
    async buildAndSave() {
        const entries = await TimeEntry.create(this.data);
        return entries;
    }
}

module.exports = TimeEntryBuilder;