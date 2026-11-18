const { summarizeWinningVsAverageBids } = require('../winningVsAverageBidHelpers');

const listings = [
  { _id: 'l1', title: 'Cabin A', village: 'v1' },
  { _id: 'l2', title: 'Cabin B', village: 'v1' },
];
const villages = [{ _id: 'v1', name: 'Eco Village' }];
const bid = (price, at) => ({ bidPrice: price, createdDatetime: new Date(at) });
const deadlines = [
  {
    listingId: 'l1',
    isClosed: true,
    endDate: new Date('2026-03-10'),
    biddingHistory: [bid('100', '2026-03-01'), bid('200', '2026-03-05')],
  },
  {
    listingId: 'l2',
    isClosed: false,
    endDate: new Date('2026-04-10'),
    biddingHistory: [bid('300', '2026-04-01')],
  },
];

describe('summarizeWinningVsAverageBids', () => {
  it('computes average and confirmed winning bids per listing', () => {
    const { data } = summarizeWinningVsAverageBids({ deadlines, listings, villages });
    expect(data).toEqual([
      expect.objectContaining({ id: 'l1', averageBid: 150, winningBid: 200, totalBids: 2 }),
      expect.objectContaining({ id: 'l2', averageBid: 300, winningBid: null, totalBids: 1 }),
    ]);
  });

  it('returns identical results for identical filters', () => {
    const args = { deadlines, listings, villages, category: 'village' };
    expect(summarizeWinningVsAverageBids(args)).toEqual(summarizeWinningVsAverageBids(args));
  });

  it('groups by village and applies the date range', () => {
    const { data } = summarizeWinningVsAverageBids({
      deadlines,
      listings,
      villages,
      category: 'village',
      start: new Date('2026-03-04'),
      end: new Date('2026-03-31'),
    });
    expect(data).toEqual([
      expect.objectContaining({ id: 'v1', averageBid: 200, winningBid: 200, totalBids: 1 }),
    ]);
  });

  it('returns empty data when nothing matches', () => {
    const { data } = summarizeWinningVsAverageBids({ deadlines, listings, villages, ids: ['x'] });
    expect(data).toEqual([]);
  });
});
