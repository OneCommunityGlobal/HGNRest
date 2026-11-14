const STOCK_PRECISION = 4;
const STOCK_TOLERANCE = 0.0001;
const HTTP_CONFLICT = 409;
const roundQuantity = (value) => Number(value.toFixed(STOCK_PRECISION));

const stockError = (message, status = 400) => Object.assign(new Error(message), { status });

// Validate saved totals, never the stock snapshot supplied by the browser.
const buildMaterialUpdate = (material, payload, metadata) => {
  const keys = ['stockBought', 'stockUsed', 'stockWasted', 'stockAvailable'];
  if (keys.some((key) => !Number.isFinite(material[key]) || material[key] < 0)) {
    throw stockError(
      'Material stock needs investigation before further usage can be logged.',
      HTTP_CONFLICT,
    );
  }
  const available = roundQuantity(material.stockBought - material.stockUsed - material.stockWasted);
  if (available < 0 || Math.abs(available - material.stockAvailable) > STOCK_TOLERANCE) {
    throw stockError(
      'Material stock totals are inconsistent and need investigation.',
      HTTP_CONFLICT,
    );
  }
  const quantity = (value, unit) => {
    if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') {
      throw stockError('Used and wasted quantities must be finite, non-negative numbers.');
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw stockError('Used and wasted quantities must be finite, non-negative numbers.');
    }
    if (!['unit', 'absolute', 'percent', undefined].includes(unit)) {
      throw stockError('Invalid quantity unit.');
    }
    const result = unit === 'percent' ? (parsed / 100) * available : parsed;
    if (!Number.isFinite(result) || result > available) {
      throw stockError('Used + Wasted exceeds the total stock available.');
    }
    return roundQuantity(result);
  };
  const quantityUsed = quantity(payload.quantityUsed, payload.QtyUsedLogUnit);
  const quantityWasted = quantity(payload.quantityWasted, payload.QtyWastedLogUnit);
  if (roundQuantity(quantityUsed + quantityWasted) > available) {
    throw stockError('Used + Wasted exceeds the total stock available.');
  }
  const stockUsed = roundQuantity(material.stockUsed + quantityUsed);
  const stockWasted = roundQuantity(material.stockWasted + quantityWasted);
  return {
    // Compare-and-set prevents concurrent requests from overwriting newer totals.
    filter: Object.fromEntries(['_id', ...keys].map((key) => [key, material[key]])),
    update: {
      $set: {
        stockUsed,
        stockWasted,
        stockAvailable: roundQuantity(material.stockBought - stockUsed - stockWasted),
      },
      $push: { updateRecord: { ...metadata, quantityUsed, quantityWasted } },
    },
  };
};

module.exports = { buildMaterialUpdate, stockError };
