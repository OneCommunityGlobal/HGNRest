var mongoose = require('mongoose'),
     Schema = mongoose.Schema;


var timelogSchema = new Schema({
	
	createdDate: { type: Date, default: Date.now },
	lastModifiedDate: { type: Date, default: Date.now },
	totalSeconds: Number,
	tangible: Boolean,
	workCompletedDescription: String,
	project: String,
	task: String
});


module.exports = mongoose.model('TimeLog', timelogSchema);