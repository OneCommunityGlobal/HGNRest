const mongoose = require('mongoose');

const { Schema } = mongoose;

const buildingEquipment = new Schema({
  itemType: { type: mongoose.SchemaTypes.ObjectId, ref: 'invTypeBase' },
  project: { type: mongoose.SchemaTypes.ObjectId, ref: 'buildingProject' },
  code: { type: Number }, // add function to create code for on-site tool tracking.Not marked as 'required' as it breaks the tool purchase form functionality.
  purchaseStatus: { type: String, enum: ['Rental', 'Purchase', 'Purchased', 'Rented'] },
  // add discriminator based on rental or purchase so these fields are required if tool is rented. Not marked as 'required' as it breaks the tool purchase form functionality.
  rentedOnDate: Date,
  rentalDue: Date,
  userResponsible: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
  equipmentClass: { type: String },
  currentUsage: { type: String, enum: ['Operational', 'Under Maintenance', 'Out of Service'] },
  condition: { type: String, enum: ['New', 'Used', 'Refurbished'] },
  purchaseRecord: [
    {
      // track purchase/rental requests
      _id: false, // do not add _id field to subdocument
      date: { type: Date, default: Date.now() },
      requestedBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
      priority: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
      brand: String,
      status: { type: String, default: 'Pending', enum: ['Approved', 'Pending', 'Rejected'] },
    },
  ],
  updateRecord: [
    {
      // track tool condition updates
      _id: false,
      date: { type: Date, default: Date.now() },
      createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
      condition: {
        type: String,
        enum: [
          // values sent by the Update Tool/Equipment Status form
          'Working well',
          'Broken/Needs repair',
          'Stolen/Lost',
          'End of life',
          'Returned',
          // legacy values kept so existing records stay valid
          'Good',
          'Needs Repair',
          'Out of Order',
        ],
      },
      lastUsedBy: { type: String, default: '' },
      lastUsedFor: { type: String, default: '' },
      replacementRequired: { type: String, default: '' },
      description: { type: String, default: '' },
      notes: { type: String, default: '' },
    },
  ],
  logRecord: [
    {
      // track tool daily check in/out and use
      _id: false,
      date: { type: Date, default: Date.now() },
      createdBy: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
      responsibleUser: { type: mongoose.SchemaTypes.ObjectId, ref: 'userProfile' },
      type: { type: String, enum: ['Check In', 'Check Out'] }, // default = opposite of current log status?
    },
  ],
});

module.exports = mongoose.model('buildingEquipment', buildingEquipment, 'buildingEquipments');
