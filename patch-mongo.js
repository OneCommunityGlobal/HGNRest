const mongoose = require('mongoose');
const orig = mongoose.connect.bind(mongoose);
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hgnData_dev';
mongoose.connect = (u, opts, ...rest) => orig(uri, opts, ...rest);
