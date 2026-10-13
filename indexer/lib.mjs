// Shared logic: event decoding, lien state machine, debt math, aggregation.
// Kept free of network calls so it can be tested offline.
import { Interface } from "ethers";

// Blend proxy on Ethereum mainnet (implementation 0xB258CA5559b11cD702F363796522b04D7722Ea56).
export const BLEND_ADDRESS = "0x29469395eAf6f95920E59F858042f0e28D98a20B";
// Blend went live in early May 2023. Scanning from slightly before is safe.
export const BLEND_START_BLOCK = 17_160_000;

// None of Blend's lifecycle event params are indexed, so everything lives in log data.
export const BLEND_ABI = [
  "event LoanOfferTaken(bytes32 offerHash, uint256 lienId, address collection, address lender, address borrower, uint256 loanAmount, uint256 rate, uint256 tokenId, uint256 auctionDuration)",
  "event Refinance(uint256 lienId, address collection, address newLender, uint256 newAmount, uint256 newRate, uint256 newAuctionDuration)",
  "event Repay(uint256 lienId, address collection)",
  "event StartAuction(uint256 lienId, address collection)",
  "event Seize(uint256 lienId, address collection)",
  "event BuyLocked(uint256 lienId, address collection, address buyer, address seller, uint256 tokenId)",
];

export const iface = new Interface(BLEND_ABI);
export const TOPICS = Object.fromEntries(
  ["LoanOfferTaken", "Refinance", "Repay", "StartAuction", "Seize", "BuyLocked"].map((n) => [n, iface.getEvent(n).topicHash])
);
export const ALL_TOPICS = Object.values(TOPICS);

const WEI = 10n ** 18n;
export const toEth = (wei) => Number((BigInt(wei) * 1_000_000n) / WEI) / 1_000_000;

/**
 * Apply one decoded log to the lien map. Logs must be applied in chain order.
 * lien = { id, collection, tokenId, lender, borrower, amountWei, rateBips, startBlock, auctionDuration, auctionStartBlock }
 */
export function applyLog(liens, log) {
  const parsed = iface.parseLog({ topics: log.topics, data: log.data });
  if (!parsed) return;
  const a = parsed.args;
  const id = a.lienId.toString();
  const blockNumber = Number(log.blockNumber);

  switch (parsed.name) {
    case "LoanOfferTaken":
      liens.set(id, {
        id,
        collection: a.collection.toLowerCase(),
        tokenId: a.tokenId.toString(),
        lender: a.lender.toLowerCase(),
        borrower: a.borrower.toLowerCase(),
        amountWei: a.loanAmount.toString(),
        rateBips: Number(a.rate),
        startBlock: blockNumber,
        auctionDuration: Number(a.auctionDuration),
        auctionStartBlock: 0,
      });
      break;
    case "Refinance": {
      const l = liens.get(id);
      if (!l) break;
      // A refinance pays off the old debt and starts a fresh loan at the new terms.
      Object.assign(l, {
        lender: a.newLender.toLowerCase(),
        amountWei: a.newAmount.toString(),
        rateBips: Number(a.newRate),
        auctionDuration: Number(a.newAuctionDuration),
        startBlock: blockNumber,
        auctionStartBlock: 0,
      });
      break;
    }
    case "StartAuction": {
      const l = liens.get(id);
      if (l) l.auctionStartBlock = blockNumber;
      break;
    }
    case "Repay":
    case "Seize":
    case "BuyLocked":
      liens.delete(id);
      break;
  }
}

/**
 * Blend accrues interest continuously: debt = amount * e^(rate * years), rate in bips per year.
 * During a refinancing auction the on-chain rate can climb further; we use the base rate,
 * so auction loans are shown at a slight underestimate (flagged in the UI).
 */
export function currentDebtEth(amountWei, rateBips, startTs, nowTs) {
  const years = Math.max(0, nowTs - startTs) / (365 * 24 * 3600);
  return toEth(amountWei) * Math.exp((rateBips / 10_000) * years);
}

// LTV buckets used by the histogram on the site.
export const LTV_BUCKETS = [
  { key: "lt50", label: "Under 50%", max: 0.5 },
  { key: "50_75", label: "50 to 75%", max: 0.75 },
  { key: "75_90", label: "75 to 90%", max: 0.9 },
  { key: "90_100", label: "90 to 100%", max: 1.0 },
  { key: "100_125", label: "100 to 125%", max: 1.25 },
  { key: "gt125", label: "Over 125%", max: Infinity },
];

// Floor drop steps for the "how much goes underwater if floor falls" curve.
export const DROP_STEPS = [0, 5, 10, 15, 20, 25, 30, 40, 50];

/**
 * Build the JSON the site reads.
 * liens: array with startTs filled in. floors: { [collection]: { name, slug, floorEth, image } }
 */
export function buildReport(liens, floors, { nowTs, block, deadlineIso }) {
  const byCol = new Map();
  for (const l of liens) {
    if (!byCol.has(l.collection)) byCol.set(l.collection, []);
    byCol.get(l.collection).push(l);
  }

  const collections = [];
  for (const [address, list] of byCol) {
    const f = floors[address] || {};
    const floor = typeof f.floorEth === "number" && f.floorEth > 0 ? f.floorEth : null;
    const loans = list
      .map((l) => {
        const debt = currentDebtEth(l.amountWei, l.rateBips, l.startTs, nowTs);
        return {
          lienId: l.id,
          tokenId: l.tokenId,
          borrower: l.borrower,
          lender: l.lender,
          principal: round(toEth(l.amountWei)),
          debt: round(debt),
          aprPct: round(l.rateBips / 100, 2),
          ltv: floor ? round(debt / floor, 4) : null,
          underwater: floor ? debt > floor : null,
          inAuction: l.auctionStartBlock > 0,
          startTs: l.startTs,
        };
      })
      .sort((a, b) => b.debt - a.debt);

    const totalDebt = sum(loans.map((x) => x.debt));
    const uw = loans.filter((x) => x.underwater);
    const buckets = Object.fromEntries(LTV_BUCKETS.map((b) => [b.key, { count: 0, debt: 0 }]));
    if (floor) {
      for (const x of loans) {
        const b = LTV_BUCKETS.find((b) => x.ltv < b.max);
        buckets[b.key].count++;
        buckets[b.key].debt += x.debt;
      }
    }
    const dropCurve = floor
      ? DROP_STEPS.map((pct) => {
          const f2 = floor * (1 - pct / 100);
          const under = loans.filter((x) => x.debt > f2);
          return { dropPct: pct, floor: round(f2), count: under.length, debt: round(sum(under.map((x) => x.debt))) };
        })
      : [];

    collections.push({
      address,
      name: f.name || shortAddr(address),
      slug: f.slug || null,
      image: f.image || null,
      floorEth: floor,
      loanCount: loans.length,
      totalDebt: round(totalDebt),
      avgAprPct: round(loans.length ? sum(loans.map((x) => x.aprPct)) / loans.length : 0, 2),
      underwaterCount: floor ? uw.length : null,
      underwaterDebt: floor ? round(sum(uw.map((x) => x.debt))) : null,
      // Shortfall: how much more debt than collateral value sits in underwater loans.
      shortfall: floor ? round(sum(uw.map((x) => x.debt - floor))) : null,
      inAuctionCount: loans.filter((x) => x.inAuction).length,
      ltvBuckets: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, { count: v.count, debt: round(v.debt) }])),
      dropCurve,
      loans,
    });
  }
  collections.sort((a, b) => b.totalDebt - a.totalDebt);

  const priced = collections.filter((c) => c.floorEth);
  return {
    generatedAt: new Date(nowTs * 1000).toISOString(),
    block,
    deadline: deadlineIso,
    totals: {
      loanCount: sum(collections.map((c) => c.loanCount)),
      totalDebt: round(sum(collections.map((c) => c.totalDebt))),
      underwaterCount: sum(priced.map((c) => c.underwaterCount)),
      underwaterDebt: round(sum(priced.map((c) => c.underwaterDebt))),
      shortfall: round(sum(priced.map((c) => c.shortfall))),
      inAuctionCount: sum(collections.map((c) => c.inAuctionCount)),
      collectionCount: collections.length,
      unpricedCollections: collections.length - priced.length,
    },
    ltvBuckets: LTV_BUCKETS.map((b) => ({ key: b.key, label: b.label })),
    collections,
  };
}

const sum = (arr) => arr.reduce((s, x) => s + x, 0);
const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const shortAddr = (a) => a.slice(0, 6) + "…" + a.slice(-4);
