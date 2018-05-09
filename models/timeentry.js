var mongoose = require('mongoose');
var Schema = mongoose.Schema;


var TimeEntry = new Schema({
	personId: { type: Schema.Types.ObjectId, required: [true, "Resource is a required field"], ref: 'userProfile' },
	projectId: { type: Schema.Types.ObjectId, required: [true, "Project is a required field"], ref: 'project' },
	dateofWork: { type: Date, required: true },
	totalSeconds: { type: Number },
	notes: { type: String },
	isTangible: { type: Boolean, default: false },
	createdDateTime: { type: Date },
	lastModifiedDateTime: { type: Date, default: Date.now },

});

module.exports = mongoose.model('timeEntry', TimeEntry, 'timeEntries');