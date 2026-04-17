// Fetches NFT holdings with floor prices via Reservoir API (free, no key needed)
// Supports Ethereum mainnet only for now

const cache = {};
const TTL = 300000; // 5 minutes

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'address required' });

  const key = address.toLowerCase();
  if (cache[key] && Date.now() - cache[key].ts < TTL) {
    return res.json(cache[key].data);
  }

  try {
    const r = await fetch(
      `https://api.reservoir.tools/users/${address}/tokens/v7?limit=200&includeTopBid=false&excludeSpam=true&sortBy=acquiredAt`,
      {
        headers: {
          'accept': 'application/json',
          'x-api-key': process.env.RESERVOIR_API_KEY || 'demo', // free demo key works for basic usage
        },
      }
    );

    if (!r.ok) throw new Error(`Reservoir HTTP ${r.status}`);
    const data = await r.json();

    // Group into collections
    const collections = {};
    for (const item of data.tokens || []) {
      const t = item.token || {};
      const colId = t.collection?.id || 'unknown';
      const colName = t.collection?.name || 'Unknown Collection';
      const floorUsd = item.market?.floorAsk?.price?.amount?.usd || 0;
      const floorEth = item.market?.floorAsk?.price?.amount?.native || 0;
      const image = t.collection?.imageUrl || t.image || null;

      if (!collections[colId]) {
        collections[colId] = {
          name: colName,
          image,
          count: 0,
          floorUsd,
          floorEth,
          totalUsd: 0,
        };
      }
      collections[colId].count++;
      collections[colId].totalUsd += floorUsd;
    }

    const colList = Object.values(collections)
      .filter(c => c.totalUsd > 0 || c.count > 0)
      .sort((a, b) => b.totalUsd - a.totalUsd)
      .slice(0, 50);

    const totalUsd = colList.reduce((s, c) => s + c.totalUsd, 0);
    const totalNfts = colList.reduce((s, c) => s + c.count, 0);

    const result = { address, collections: colList, totalUsd, totalNfts };
    cache[key] = { ts: Date.now(), data: result };
    res.json(result);
  } catch (e) {
    console.error('NFT fetch error:', e.message);
    res.status(500).json({ error: e.message, collections: [], totalUsd: 0, totalNfts: 0 });
  }
}
