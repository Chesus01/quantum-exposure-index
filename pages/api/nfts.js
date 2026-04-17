// NFT holdings scanner
// OpenSea v2  → Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche
// OpenSea SDK → Abstract  (Chain.Abstract, floor prices included)
// Magic Eden  → Solana
// Returns unified { chain, collections:[{name,image,count,floorUsd,totalUsd}], totalUsd, totalNfts }

const cache = {};
const TTL   = 300000; // 5 min

// Map our chain IDs → OpenSea v2 chain slugs
const OS_CHAIN = {
  ethereum: 'ethereum',
  polygon:  'matic',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  base:     'base',
  avalanche:'avalanche',
};

// ── helpers ────────────────────────────────────────────────────────────────
function slug2name(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

async function coinPrice(id) {
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(4000) }
    );
    const d = await r.json();
    return d[id]?.usd || 0;
  } catch { return 0; }
}

// ── OpenSea (EVM — all chains except Abstract) ──────────────────────────────
async function openSeaNFTs(address, osChain, apiKey) {
  // 1. list NFTs
  const nftsRes = await fetch(
    `https://api.opensea.io/api/v2/chain/${osChain}/account/${address}/nfts?limit=200`,
    { headers: { 'X-API-KEY': apiKey, accept: 'application/json' },
      signal: AbortSignal.timeout(8000) }
  );
  if (!nftsRes.ok) throw new Error(`OpenSea NFTs ${nftsRes.status}`);
  const { nfts = [] } = await nftsRes.json();

  // 2. group by collection slug
  const byCol = {};
  for (const n of nfts) {
    const slug = n.collection;
    if (!slug) continue;
    if (!byCol[slug]) byCol[slug] = { slug, count: 0, image: null };
    byCol[slug].count++;
    if (!byCol[slug].image && n.image_url) byCol[slug].image = n.image_url;
  }

  // 3. fetch floor prices for top 15 collections in parallel
  const top = Object.values(byCol).sort((a, b) => b.count - a.count).slice(0, 15);
  const ethUsd = await coinPrice('ethereum');

  await Promise.all(top.map(async col => {
    try {
      const sr = await fetch(
        `https://api.opensea.io/api/v2/collections/${col.slug}/stats`,
        { headers: { 'X-API-KEY': apiKey, accept: 'application/json' },
          signal: AbortSignal.timeout(5000) }
      );
      if (sr.ok) {
        const { total } = await sr.json();
        col.floorEth = total?.floor_price || 0;
        col.floorUsd = col.floorEth * ethUsd;
      }
    } catch { col.floorEth = 0; col.floorUsd = 0; }
    col.name = slug2name(col.slug);
    col.totalUsd = (col.floorUsd || 0) * col.count;
  }));

  return top;
}

// ── OpenSea SDK (Abstract) ──────────────────────────────────────────────────
async function abstractNFTs(address) {
  const { OpenSeaSDK, Chain } = await import('@opensea/sdk');
  const { JsonRpcProvider } = await import('ethers');

  const apiKey     = process.env.OPENSEA_API_KEY || '';
  const alchemyKey = process.env.ALCHEMY_API_KEY || '';
  const rpcUrl     = alchemyKey
    ? `https://abstract-mainnet.g.alchemy.com/v2/${alchemyKey}`
    : 'https://api.mainnet.abs.xyz';

  const provider = new JsonRpcProvider(rpcUrl);
  const sdk = new OpenSeaSDK(provider, { chain: Chain.Abstract, apiKey });

  // 1. Fetch all NFTs (up to 200 via two pages of 100)
  let allNfts = [];
  try {
    const page1 = await sdk.api.getNFTsByAccount(address, 100, undefined, Chain.Abstract);
    allNfts = page1.nfts || [];
    if (page1.next && allNfts.length === 100) {
      try {
        const page2 = await sdk.api.getNFTsByAccount(address, 100, page1.next, Chain.Abstract);
        allNfts = allNfts.concat(page2.nfts || []);
      } catch { /* ignore pagination errors */ }
    }
  } catch (e) {
    throw new Error(`OpenSea SDK (Abstract) getNFTsByAccount: ${e.message}`);
  }

  // 2. Group by collection slug
  const byCol = {};
  for (const n of allNfts) {
    const slug = n.collection;
    if (!slug) continue;
    if (!byCol[slug]) byCol[slug] = { slug, count: 0, image: null };
    byCol[slug].count++;
    if (!byCol[slug].image && n.image_url) byCol[slug].image = n.image_url;
  }

  // 3. Floor prices via SDK getCollectionStats — top 15 collections
  const top = Object.values(byCol).sort((a, b) => b.count - a.count).slice(0, 15);
  const ethUsd = await coinPrice('ethereum');

  await Promise.all(top.map(async col => {
    col.name = slug2name(col.slug);
    try {
      const stats = await sdk.api.getCollectionStats(col.slug);
      const floorEth = stats?.total?.floor_price || 0;
      // floor_price_symbol is usually 'ETH' on Abstract
      col.floorEth = floorEth;
      col.floorUsd = floorEth * ethUsd;
    } catch {
      col.floorEth = 0;
      col.floorUsd = 0;
    }
    col.totalUsd = (col.floorUsd || 0) * col.count;
  }));

  return top;
}

// ── Magic Eden (Solana) ─────────────────────────────────────────────────────
async function magicEdenNFTs(address) {
  const tokRes = await fetch(
    `https://api-mainnet.magiceden.dev/v2/wallets/${address}/tokens?limit=100&listStatus=both`,
    { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
  );
  if (!tokRes.ok) throw new Error(`Magic Eden tokens ${tokRes.status}`);
  const tokens = await tokRes.json();
  if (!Array.isArray(tokens)) throw new Error('Magic Eden unexpected response');

  const byCol = {};
  for (const t of tokens) {
    const sym = t.collection;
    if (!sym) continue;
    if (!byCol[sym]) byCol[sym] = { symbol: sym, name: t.collectionName || slug2name(sym), count: 0, image: t.image || null };
    byCol[sym].count++;
  }

  const top = Object.values(byCol).sort((a, b) => b.count - a.count).slice(0, 15);
  const solUsd = await coinPrice('solana');

  await Promise.all(top.map(async col => {
    try {
      const sr = await fetch(
        `https://api-mainnet.magiceden.dev/v2/collections/${col.symbol}/stats`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (sr.ok) {
        const stats = await sr.json();
        col.floorSol = (stats.floorPrice || 0) / 1e9;
        col.floorUsd = col.floorSol * solUsd;
      }
    } catch { col.floorSol = 0; col.floorUsd = 0; }
    col.totalUsd = (col.floorUsd || 0) * col.count;
  }));

  return top;
}

// ── handler ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { address, chain } = req.query;
  if (!address || !chain) return res.status(400).json({ error: 'address and chain required' });

  const cacheKey = `${chain}:${address.toLowerCase()}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    return res.json(cache[cacheKey].data);
  }

  try {
    let collections = [];

    if (chain === 'solana') {
      collections = await magicEdenNFTs(address);
    } else if (chain === 'abstract') {
      collections = await abstractNFTs(address);
    } else {
      const osChain = OS_CHAIN[chain];
      if (!osChain) {
        return res.json({ chain, collections: [], totalUsd: 0, totalNfts: 0, unsupported: true });
      }
      const apiKey = process.env.OPENSEA_API_KEY || '';
      if (!apiKey) {
        return res.json({ chain, collections: [], totalUsd: 0, totalNfts: 0,
          error: 'Add OPENSEA_API_KEY to Vercel to enable NFT scanning' });
      }
      collections = await openSeaNFTs(address, osChain, apiKey);
    }

    const result = {
      chain,
      collections: collections
        .map(c => ({ name: c.name, image: c.image, count: c.count, floorUsd: c.floorUsd || 0, totalUsd: c.totalUsd || 0 }))
        .sort((a, b) => b.totalUsd - a.totalUsd),
      totalUsd:  collections.reduce((s, c) => s + (c.totalUsd || 0), 0),
      totalNfts: collections.reduce((s, c) => s + c.count, 0),
    };

    cache[cacheKey] = { ts: Date.now(), data: result };
    res.json(result);
  } catch (e) {
    console.error('NFT scan error:', chain, e.message);
    res.status(500).json({ error: e.message, chain, collections: [], totalUsd: 0, totalNfts: 0 });
  }
}
