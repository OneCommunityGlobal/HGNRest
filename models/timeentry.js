var mongoose = require('mongoose'),
Schema = mongoose.Schema;

var TimeEntry = new Schema({
    PersonId : {type: Schema.Types.ObjectId, required: true},
	ProjectId: {type: Schema.Types.ObjectId, required: true},
	TaskId : {type: String, required: true},
	createdDate: { type: Date, default: Date.now },
	lastModifiedDate: { type: Date, default: Date.now },
	totalSeconds: Number,
	tangible: Boolean,
	workDescription: String,
	rollupweek : {type: String, required: true},
	rollupmonth : {type: String, required: true},
	rollupyear : {type: String, required: true}
});

module.exports = mongoose.model("TimeEntry", TimeEntry, 'TimeEntry');