var mongoose = require('mongoose'),
Schema = mongoose.Schema;

var TimeEntry = new Schema({
    personId : {type: Schema.Types.ObjectId, required: [true, "Resource is a required field"], ref: 'userProfile'},
	projectId: {type: Schema.Types.ObjectId, required: [true, "Project is a required field"], ref: 'Project'},
	taskId : {type: String, required:  [true, "Task is a required field"]},
	dateofWork : {type : [Date, "Valid Date is required"], required: true},
	totalSeconds: {type: Number},
	notes : {type: String},
	isTangible : {type: Boolean, default: false },
	createdDateTime: { type: Date },
	lastModifiedDateTime: { type: Date, default: Date.now },	
	rollupWeek : {type: String, required: true},
	rollupMonth : {type: String, required: true},
	rollupYear : {type: String, required: true}
});

module.exports = mongoose.model('timeEntry', TimeEntry, 'timeEntries');