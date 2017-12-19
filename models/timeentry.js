var mongoose = require('mongoose'),
Schema = mongoose.Schema;

var TimeEntry = new Schema({
    personId : {type: Schema.Types.ObjectId, required: true, ref: 'userProfile'},
	projectId: {type: Schema.Types.ObjectId, required: true, ref: 'Project'},
	taskId : {type: String, required: true},
	dateofWork : {type : Date, required: true},
	totalSeconds: Number,
	notes : {type: String},
	tangible : {required: true, type: Boolean },
	createdDateTime: { type: Date },
	lastModifiedDateTime: { type: Date, default: Date.now },	
	rollupWeek : {type: String, required: true},
	rollupMonth : {type: String, required: true},
	rollupYear : {type: String, required: true}
});

module.exports = mongoose.model('timeEntry', TimeEntry, 'timeEntries');