
const mongoose = require('mongoose');
const logger = require("./logger")
mongoose.Promise = Promise;


module.exports = function() {
          
    var uri = `mongodb://${process.env.user}:${encodeURIComponent(process.env.password)}@${process.env.cluster}/${process.env.dbName}?ssl=true&replicaSet=${process.env.replicaSetName}&authSource=admin`
        
    const db = mongoose.connect(uri, { 
        useCreateIndex: true,
        useNewUrlParser: true }).catch((error) => { 

        console.log(error);
        logger.logException(error);
     });
}