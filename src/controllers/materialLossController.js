const mongoose = require('mongoose');
const { buildingMaterial } = require('../models/bmdashboard/buildingInventoryItem');
 
module.exports = function(MaterialLoss) {

  const monthNumberToName = (monthNum) => [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ][monthNum - 1];
 
  const monthNameToNumber = (monthName) => ({
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12
  })[monthName];

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

  async function computeMaterialLossForOne(materialId, monthList, endYear, currentMonthName) {
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

        if (hasData || isCurrentMonth) {
          const computed = await computeMonthLoss(materialId, year, month);
          lossPercentage = computed.lossPercentage;
        }

        const materialDoc = await buildingMaterial.findOne({ itemType: materialId }).populate('itemType', 'name');
        const materialName = materialDoc?.itemType?.name || "Unknown Material";

        await MaterialLoss.findOneAndUpdate(
          { materialId, year, month: monthName },
          {
            materialId,
            materialName,
            year,
            month: monthName,
            lossPercentage,
            updatedAt: new Date()
          },
          { upsert: true }
        );
      }
    }));
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

    if (materialId) {
      await computeMaterialLossForOne(materialId, monthList, endYear, currentMonthName);
    } else {
      const materialIds = await buildingMaterial.distinct("itemType", { __t: "material_item" });
      await Promise.all(
        materialIds.map(matId =>
          computeMaterialLossForOne(matId.toString(), monthList, endYear, currentMonthName)
        )
      );
    }
  }

  const getMaterialLossData = async (req, res) => {
    const { materialId, year, startDate, endDate } = req.query;
    await computeAndStoreHistoricalLoss(materialId);

    const filter = {};
    if (materialId) filter.materialId = materialId;
    if (year) filter.year = parseInt(year, 10);

    const monthArray = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      const startYear = start ? start.getUTCFullYear() : null;
      const startMonth = start ? start.getUTCMonth() + 1 : null;
      const endYear = end ? end.getUTCFullYear() : null;
      const endMonth = end ? end.getUTCMonth() + 1 : null;

      filter.$and = [];
      if (start) {
        filter.$and.push({
          $or: [
            { year: { $gt: startYear } },
            {
              year: startYear,
              month: { $in: monthArray.slice(startMonth - 1) }
            }
          ]
        });
      }
      if (end) {
        filter.$and.push({
          $or: [
            { year: { $lt: endYear } },
            {
              year: endYear,
              month: { $in: monthArray.slice(0, endMonth) }
            }
          ]
        });
      }
    }

    const result = await MaterialLoss.find(filter, {
      _id: 0,
      month: 1,
      lossPercentage: 1,
      year: 1,
      // materialId: 0,
      materialName: 1
    });

    const sortedResult = result.sort((a, b) => 
     (a.year - b.year) || (monthNameToNumber(a.month) - monthNameToNumber(b.month))
    );
    res.status(200).json({ data: sortedResult });
  };

  return { getMaterialLossData };
};


// const mongoose = require('mongoose');
// const { buildingMaterial } = require('../models/bmdashboard/buildingInventoryItem');

// module.exports = function(MaterialLoss) {

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
//     const matchStage = { __t: 'material_item', updateRecord: { $exists: true, $ne: [] } };
//     if (materialId) matchStage.itemType = new mongoose.Types.ObjectId(materialId);

//     const pipeline = [
//       { $match: matchStage },
//       { $unwind: "$updateRecord" },
//       { $match: { "updateRecord.date": { $gte: monthStart, $lte: monthEnd } } },
//       { $group: {
//           _id: null,
//           totalUsed: { $sum: "$updateRecord.quantityUsed" },
//           totalWasted: { $sum: "$updateRecord.quantityWasted" }
//         }
//       }
//     ];

//     const result = await buildingMaterial.aggregate(pipeline);
//     const totalUsed = result[0]?.totalUsed || 0;
//     const totalWasted = result[0]?.totalWasted || 0;
//     const lossPerc = totalUsed + totalWasted ? ((totalWasted / (totalUsed + totalWasted)) * 100).toFixed(2) : 0;

//     return {
//       lossPercentage: parseFloat(lossPerc),
//       year,
//       month: monthNumberToName(month)
//     };
//   }

//   async function computeAndStoreHistoricalLoss(materialId) {
//     const matchStage = { __t: 'material_item', updateRecord: { $exists: true, $ne: [] } };
//     if (materialId) matchStage.itemType = new mongoose.Types.ObjectId(materialId);

//     const minDateAgg = await buildingMaterial.aggregate([
//       { $match: matchStage },
//       { $unwind: "$updateRecord" },
//       {
//         $group: {
//           _id: null,
//           minDate: { $min: "$updateRecord.date" }
//         }
//       }
//     ]);

//     const startDate = minDateAgg[0]?.minDate ? new Date(minDateAgg[0].minDate) : null;
//     if (!startDate) return;

//     const now = new Date();
//     const startYear = startDate.getUTCFullYear();
//     const startMonth = startDate.getUTCMonth() + 1;
//     const endYear = now.getUTCFullYear();
//     const endMonth = now.getUTCMonth() + 1;
//     const currentMonthName = monthNumberToName(endMonth);

//     const monthList = [];
//     for (let y = startYear; y <= endYear; y += 1) {
//       const mStart = y === startYear ? startMonth : 1;
//       const mEnd = y === endYear ? endMonth : 12;
//       for (let m = mStart; m <= mEnd; m += 1) {
//         monthList.push({ year: y, month: m });
//       }
//     }

//     await Promise.all(monthList.map(async ({ year, month }) => {
//       const monthName = monthNumberToName(month);
//       const existing = await MaterialLoss.findOne({ materialId, year, month: monthName });
//       const isCurrentMonth = year === endYear && monthName === currentMonthName;

//       if (!existing || isCurrentMonth) {
//         let lossPercentage = 0;
//         const matchDate = getMonthStartEnd(year, month).monthStart;

//         const hasData = await buildingMaterial.exists({
//           itemType: materialId,
//           updateRecord: {
//             $elemMatch: {
//               date: { $gte: matchDate },
//             }
//           }
//         });

//         if (hasData) {
//           const computed = await computeMonthLoss(materialId, year, month);
//           lossPercentage = computed.lossPercentage;
//         }

//         const materialDoc = await buildingMaterial.findOne({ itemType: materialId }).populate('itemType', 'name');
//         const materialName = materialDoc?.itemType?.name || "Unknown Material";

//         await MaterialLoss.create({
//           materialId,
//           materialName,
//           year,
//           month: monthName,
//           lossPercentage,
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

//     const result = await MaterialLoss.find(filter, {
//       _id: 0,
//       month: 1,
//       lossPercentage: 1,
//       year: 1
//     }).sort({ year: 1, month: 1 });

//     res.status(200).json({ data: result });
//   };

//   return { getMaterialLossData };
// };