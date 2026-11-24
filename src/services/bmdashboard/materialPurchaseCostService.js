const mongoose = require('mongoose');
const BuildingMaterial = require('../../models/bmdashboard/buildingMaterial');

/**
 * Material cost per project from approved purchases (quantity x unit price).
 * Purchase requests have no price field, so most purchases are saved with unitPrice 0.
 * In that case the material type's unit price (entered on Add Material) is used.
 * Used by both Total Material Cost Per Project and Cost Breakdown by Category,
 * so the two charts always show the same material cost.
 */
async function getMaterialPurchaseCostByProject({ projectIds, startDate, endDate } = {}) {
  const match = { 'purchaseRecord.status': 'Approved' };
  if (projectIds && projectIds.length > 0) {
    match.project = { $in: projectIds.map((id) => new mongoose.Types.ObjectId(id)) };
  }
  if (startDate || endDate) {
    match['purchaseRecord.date'] = {};
    if (startDate) match['purchaseRecord.date'].$gte = new Date(startDate);
    if (endDate) match['purchaseRecord.date'].$lte = new Date(endDate);
  }

  return BuildingMaterial.aggregate([
    { $unwind: '$purchaseRecord' },
    { $match: match },
    {
      $lookup: {
        from: 'buildingInventoryTypes',
        localField: 'itemType',
        foreignField: '_id',
        as: 'materialType',
      },
    },
    {
      $addFields: {
        effectiveUnitPrice: {
          $cond: [
            { $gt: [{ $ifNull: ['$purchaseRecord.unitPrice', 0] }, 0] },
            '$purchaseRecord.unitPrice',
            { $ifNull: [{ $arrayElemAt: ['$materialType.unitPrice', 0] }, 0] },
          ],
        },
      },
    },
    {
      $group: {
        _id: '$project',
        totalCost: {
          $sum: { $multiply: ['$purchaseRecord.quantity', '$effectiveUnitPrice'] },
        },
      },
    },
    { $project: { _id: 0, project: '$_id', totalCost: 1 } },
  ]);
}

module.exports = { getMaterialPurchaseCostByProject };
