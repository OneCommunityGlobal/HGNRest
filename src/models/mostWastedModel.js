// materialName: String,
//   wastagePercentage: Number,
//   projectId: ObjectId,
//   date: Date

const mongoose = require('mongoose');

const { Schema } = mongoose;
const wastedMaterialSchema = new Schema({
  projectId: {
    type: String,
    required: true,
    unique: true,
  },
  projectName: {
    type: String,
    required: true,
  },
  material: {
    type: String,
    required: true,
  },
  wastagePercentage: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
});

module.exports = mongoose.model('wastedMaterial', wastedMaterialSchema, 'wastedMaterials');
