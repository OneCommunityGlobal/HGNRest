const { buildMaterialUpdate } = require('../materialStockValidation');

const payload = (quantityUsed) => ({
  quantityUsed,
  quantityWasted: 0,
  QtyUsedLogUnit: 'unit',
  QtyWastedLogUnit: 'unit',
});

describe('stock validation after rounding', () => {
  it.each([
    [{ stockBought: 1, stockUsed: 0.00006, stockWasted: 0.00006, stockAvailable: 0.99988 }, 0.9999],
    [{ stockBought: 1.00006, stockUsed: 0, stockWasted: 0, stockAvailable: 1.00006 }, 1.0001],
  ])('rejects rounded totals above Bought for %p', (material, used) => {
    expect(() => buildMaterialUpdate({ _id: 'material', ...material }, payload(used), {})).toThrow(
      'exceeds Bought after rounding',
    );
  });

  it('allows valid decimal exhaustion despite binary floating point noise', () => {
    const material = {
      _id: 'material',
      stockBought: 0.3,
      stockUsed: 0.1,
      stockWasted: 0,
      stockAvailable: 0.2,
    };
    expect(
      buildMaterialUpdate(material, { ...payload(0.1), quantityWasted: 0.1 }, {}).update.$set,
    ).toEqual({ stockUsed: 0.2, stockWasted: 0.1, stockAvailable: 0 });
  });
});
