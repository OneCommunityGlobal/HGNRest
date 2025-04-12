// module.exports = function(materialLossModel) {
//   const mongoose = require('mongoose');
//   const { buildingMaterial } = require("../models/bmdashboard/buildingInventoryItem");

//   const monthNumberToName = (monthNum) => [
//     "Jan", "Feb", "Mar", "Apr", "May", "Jun",
//     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
//   ][monthNum - 1];

//   const getMonthStartEnd = (year, month) => {
//     const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
//     const monthEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0));
//     monthEnd.setSeconds(monthEnd.getSeconds() - 1);
//     return { monthStart, monthEnd };
//   };

//   async function computeMonthLoss(materialId, year, month) {
//     const { monthStart, monthEnd } = getMonthStartEnd(year, month);
//     console.log(monthStart, monthEnd);
//     const matchStage = { __t: 'material_item', updateRecord: { $exists: true, $ne: [] } };
//     if (materialId) matchStage.itemType = new mongoose.Types.ObjectId(materialId);
  
//     const pipeline = [
//       { $match: matchStage },
//       { $unwind: "$updateRecord" },
//       { $match: { "updateRecord.date": { $gte: monthStart, $lte: monthEnd } } },
//       { $group: { _id: null, totalUsed: { $sum: "$updateRecord.quantityUsed" }, totalWasted: { $sum: "$updateRecord.quantityWasted" } } }
//     ];
  
//     const result = await buildingMaterial.aggregate(pipeline);
//     const totalUsed = result[0]?.totalUsed || 0;
//     const totalWasted = result[0]?.totalWasted || 0;
//     const lossPerc = totalUsed + totalWasted ? ((totalWasted / (totalUsed + totalWasted)) * 100).toFixed(2) : 0;
  
//     return { lossPercentage: parseFloat(lossPerc), year, month: monthNumberToName(month) };
//   }


//   async function computeAndStoreHistoricalLoss(materialId) {
//     const matchStage = { __t: 'material_item', updateRecord: { $exists: true, $ne: [] } };
//     if (materialId) matchStage.itemType = new mongoose.Types.ObjectId(materialId);

//     const months = await buildingMaterial.aggregate([
//       { $match: matchStage },
//       { $unwind: "$updateRecord" },
//       { $group: { _id: { year: { $year: "$updateRecord.date" }, month: { $month: "$updateRecord.date" } } } }
//     ]);
//       console.log("All months：");
//       months.forEach(({ _id }) => {
//     console.log(`${_id.year}-${String(_id.month).padStart(2, '0')}`);
//   });
//     const allDates = await buildingMaterial.aggregate([
//       { $match: matchStage },
//       { $unwind: "$updateRecord" },
//       { $project: { date: "$updateRecord.date" } }
//     ]);
//     console.log("All updateRecord dates:\n", allDates.map(d => d.date.toISOString()));
    
//     await Promise.all(months.map(async ({ _id: { year, month } }) => {
//       const monthName = monthNumberToName(month);
//       const existingRecord = await materialLossModel.findOne({ materialId, year, month: monthName });

//       if (!existingRecord) {
//         const computed = await computeMonthLoss(materialId, year, month);
//         const materialDoc = await buildingMaterial.findOne({ itemType: materialId }).populate('itemType', 'name');
//         const materialName = materialDoc?.itemType?.name || "Unknown Material";

//         await materialLossModel.create({ 
//           materialId, 
//           materialName, 
//           year: computed.year, 
//           month: computed.month, 
//           lossPercentage: computed.lossPercentage, 
//           updatedAt: new Date() 
//         });
//       }
//     }));
//   }

//   const getMaterialLossData = async (req, res) => {
//     const { materialId, year, startDate, endDate } = req.query;
//     await computeAndStoreHistoricalLoss(materialId);

//     const filter = {};
//     if (materialId) filter.materialId = materialId;
//     if (year) filter.year = parseInt(year, 10);
//     if (startDate || endDate) {
//       filter.updatedAt = {};
//       if (startDate) filter.updatedAt.$gte = new Date(startDate);
//       if (endDate) filter.updatedAt.$lte = new Date(endDate);
//     }

//     const result = await materialLossModel.find(filter, { _id: 0, month: 1, lossPercentage: 1, year: 1 })
//                                           .sort({ year: 1, month: 1 });
//     res.status(200).json({ data: result });
//   };

//   return { getMaterialLossData };
// };
const mongoose = require('mongoose');
const { buildingMaterial } = require('../models/bmdashboard/buildingInventoryItem');

module.exports = function(MaterialLoss) {

  const monthNumberToName = (monthNum) => [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ][monthNum - 1];

  const getMonthStartEnd = (year, month) => {
    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    monthEnd.setSeconds(monthEnd.getSeconds() - 1);
    return { monthStart, monthEnd };
  };

  async function computeMonthLoss(materialId, year, month) {
    const { monthStart, monthEnd } = getMonthStartEnd(year, month);
    const matchStage = { __t: 'material_item', updateRecord: { $exists: true, $ne: [] } };
    if (materialId) matchStage.itemType = new mongoose.Types.ObjectId(materialId);

    const pipeline = [
      { $match: matchStage },
      { $unwind: "$updateRecord" },
      { $match: { "updateRecord.date": { $gte: monthStart, $lte: monthEnd } } },
      { $group: {
          _id: null,
          totalUsed: { $sum: "$updateRecord.quantityUsed" },
          totalWasted: { $sum: "$updateRecord.quantityWasted" }
        }
      }
    ];

    const result = await buildingMaterial.aggregate(pipeline);
    const totalUsed = result[0]?.totalUsed || 0;
    const totalWasted = result[0]?.totalWasted || 0;
    const lossPerc = totalUsed + totalWasted ? ((totalWasted / (totalUsed + totalWasted)) * 100).toFixed(2) : 0;

    return {
      lossPercentage: parseFloat(lossPerc),
      year,
      month: monthNumberToName(month)
    };
  }

  async function computeAndStoreHistoricalLoss(materialId) {
    const matchStage = { __t: 'material_item', updateRecord: { $exists: true, $ne: [] } };
    if (materialId) matchStage.itemType = new mongoose.Types.ObjectId(materialId);

    const minDateAgg = await buildingMaterial.aggregate([
      { $match: matchStage },
      { $unwind: "$updateRecord" },
      {
        $group: {
          _id: null,
          minDate: { $min: "$updateRecord.date" }
        }
      }
    ]);

    const startDate = minDateAgg[0]?.minDate ? new Date(minDateAgg[0].minDate) : null;
    if (!startDate) return;

    const now = new Date();
    const startYear = startDate.getUTCFullYear();
    const startMonth = startDate.getUTCMonth() + 1;
    const endYear = now.getUTCFullYear();
    const endMonth = now.getUTCMonth() + 1;
    const currentMonthName = monthNumberToName(endMonth);

    const monthList = [];
    for (let y = startYear; y <= endYear; y += 1) {
      const mStart = y === startYear ? startMonth : 1;
      const mEnd = y === endYear ? endMonth : 12;
      for (let m = mStart; m <= mEnd; m += 1) {
        monthList.push({ year: y, month: m });
      }
    }
    
    await Promise.all(monthList.map(async ({ year, month }) => {
      const monthName = monthNumberToName(month);
      const existing = await MaterialLoss.findOne({ materialId, year, month: monthName });
      const isCurrentMonth = year === endYear && monthName === currentMonthName;

      if (!existing || isCurrentMonth) {
        let lossPercentage = 0;
        const matchDate = getMonthStartEnd(year, month).monthStart;

        const hasData = await buildingMaterial.exists({
          itemType: materialId,
          updateRecord: {
            $elemMatch: {
              date: { $gte: matchDate },
            }
          }
        });

        if (hasData) {
          const computed = await computeMonthLoss(materialId, year, month);
          lossPercentage = computed.lossPercentage;
        }

        const materialDoc = await buildingMaterial.findOne({ itemType: materialId }).populate('itemType', 'name');
        const materialName = materialDoc?.itemType?.name || "Unknown Material";

        await MaterialLoss.create({
          materialId,
          materialName,
          year,
          month: monthName,
          lossPercentage,
          updatedAt: new Date()
        });
      }
    }));
  }

  const getMaterialLossData = async (req, res) => {
    const { materialId, year, startDate, endDate } = req.query;
    await computeAndStoreHistoricalLoss(materialId);

    const filter = {};
    if (materialId) filter.materialId = materialId;
    if (year) filter.year = parseInt(year, 10);
    if (startDate || endDate) {
      filter.updatedAt = {};
      if (startDate) filter.updatedAt.$gte = new Date(startDate);
      if (endDate) filter.updatedAt.$lte = new Date(endDate);
    }

    const result = await MaterialLoss.find(filter, {
      _id: 0,
      month: 1,
      lossPercentage: 1,
      year: 1
    }).sort({ year: 1, month: 1 });

    res.status(200).json({ data: result });
  };

  return { getMaterialLossData };
};