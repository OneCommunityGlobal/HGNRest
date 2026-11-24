const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = parseFloat(value.toString());
  return Number.isFinite(parsed) ? parsed : null;
};

const isInRange = (date, start, end) => {
  if (!start && !end) return true;
  if (!date) return false;
  const time = new Date(date).getTime();
  if (Number.isNaN(time)) return false;
  if (start && time < start.getTime()) return false;
  if (end && time > end.getTime()) return false;
  return true;
};

const round2 = (value) => Math.round(value * 100) / 100;

const byName = (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

/**
 * Builds Winning Bid vs Average Bid stats from bid deadline records.
 *
 * - averageBid: mean of every bid placed (createdDatetime) inside the date range.
 * - winningBid: mean of the confirmed winning bids, i.e. the highest bid of each
 *   closed auction (isClosed, set by the bid winner cron job) whose endDate is in range.
 * Output order is deterministic so identical filters return identical results.
 */
const summarizeWinningVsAverageBids = ({
  deadlines = [],
  listings = [],
  villages = [],
  start = null,
  end = null,
  category = 'property',
  ids = [],
  limit = 10,
}) => {
  const listingById = new Map(listings.map((l) => [String(l._id), l]));
  const villageNameById = new Map(villages.map((v) => [String(v._id), v.name]));
  const listingOptions = new Map();
  const villageOptions = new Map();
  const groups = new Map();

  deadlines.forEach((deadline) => {
    const listingId = deadline.listingId ? String(deadline.listingId) : null;
    const listing = listingId ? listingById.get(listingId) : null;
    if (!listing) return;

    const villageId = listing.village ? String(listing.village) : null;
    const villageName = villageId ? villageNameById.get(villageId) || 'Unknown village' : null;
    listingOptions.set(listingId, { id: listingId, name: listing.title, villageId });
    if (villageId) villageOptions.set(villageId, { id: villageId, name: villageName });

    const groupId = category === 'village' ? villageId : listingId;
    if (!groupId || (ids.length > 0 && !ids.includes(groupId))) return;

    const bids = (deadline.biddingHistory || [])
      .map((bid) => ({ price: toNumber(bid.bidPrice), at: bid.createdDatetime }))
      .filter((bid) => bid.price !== null);

    const group = groups.get(groupId) || {
      id: groupId,
      name: category === 'village' ? villageName : listing.title,
      bidTotal: 0,
      bidCount: 0,
      winningTotal: 0,
      winningCount: 0,
    };

    bids
      .filter((bid) => isInRange(bid.at, start, end))
      .forEach((bid) => {
        group.bidTotal += bid.price;
        group.bidCount += 1;
      });

    if (deadline.isClosed && bids.length > 0 && isInRange(deadline.endDate, start, end)) {
      group.winningTotal += Math.max(...bids.map((bid) => bid.price));
      group.winningCount += 1;
    }

    groups.set(groupId, group);
  });

  const data = [...groups.values()]
    .filter((g) => g.bidCount > 0 || g.winningCount > 0)
    .map((g) => ({
      id: g.id,
      name: g.name,
      type: category,
      averageBid: g.bidCount > 0 ? round2(g.bidTotal / g.bidCount) : null,
      winningBid: g.winningCount > 0 ? round2(g.winningTotal / g.winningCount) : null,
      totalBids: g.bidCount,
      closedAuctions: g.winningCount,
    }))
    .sort(
      (a, b) =>
        (b.winningBid ?? -1) - (a.winningBid ?? -1) ||
        (b.averageBid ?? -1) - (a.averageBid ?? -1) ||
        byName(a, b),
    )
    .slice(0, limit);

  return {
    data,
    filters: {
      listings: [...listingOptions.values()].sort(byName),
      villages: [...villageOptions.values()].sort(byName),
    },
  };
};

module.exports = { summarizeWinningVsAverageBids, toNumber, isInRange };
