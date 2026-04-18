// NFT holdings scanner
// OpenSea v2 REST → Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche, Abstract
// Magic Eden     → Solana
// Returns unified { chain, collections:[{name,image,count,floorUsd,totalUsd}], totalUsd, totalNfts }

const cache = {};
const TTL   = 300000; // 5 min

// OpenSea V2 chain slugs — Abstract is supported natively
const OS_CHAIN = {
  ethereum: 'ethereum',
  polygon:  'matic',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  base:     'base',
  avalanche:'avalanche',
  abstract: 'abstract',
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

// ── OpenSea V2 REST helper with 429 retry ──────────────────────────────────
async function openseaGet(path, apiKey, retries = 2) {
  const url = `https://api.opensea.io/api/v2${path}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'X-API-KEY': apiKey, accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 429) {
        const wait = (attempt + 1) * 1500;
        console.warn(`[OS] 429 on ${path} — waiting ${wait}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      if (!res.ok) {
        console.warn(`[OS] ${res.status} on ${path}`);
        return null;
      }
      return await res.json();
    } catch (e) {
      console.warn(`[OS] fetch error on ${path}: ${e.message}`);
      if (attempt < retries) await new Promise(r => setTimeout(r, 800));
    }
  }
  return null;
}

// ── OpenSea V2 (all supported EVM chains including Abstract) ────────────────
async function openSeaNFTs(address, osChain, apiKey) {
  console.log(`[OS/${osChain}] fetching NFTs for ${address}`);

  // 1. List NFTs
  const data = await openseaGet(
    `/chain/${osChain}/account/${address}/nfts?limit=200`,
    apiKey
  );
  if (!data) throw new Error(`OpenSea NFTs fetch failed for chain ${osChain}`);
  const nfts = data.nfts || [];
  console.log(`[OS/${osChain}] ${nfts.length} NFTs found`);

  // 2. Group by collection slug
  const byCol = {};
  for (const n of nfts) {
    const slug = n.collection;
    if (!slug) continue;
    if (!byCol[slug]) byCol[slug] = { slug, count: 0, image: null };
    byCol[slug].count++;
    if (!byCol[slug].image && n.image_url) byCol[slug].image = n.image_url;
  }

  // 3. Fetch floor prices for top 15 collections
  const top = Object.values(byCol).sort((a, b) => b.count - a.count).slice(0, 15);
  const ethUsd = await coinPrice('ethereum');

  await Promise.all(top.map(async col => {
    col.name = slug2name(col.slug);
    try {
      const stats = await openseaGet(`/collections/${col.slug}/stats`, apiKey);
      col.floorEth = stats?.total?.floor_price || 0;
      col.floorUsd = col.floorEth * ethUsd;
      if (col.floorEth > 0) {
        console.log(`[OS/${osChain}] "${col.slug}" floor = ${col.floorEth} ETH`);
      } else {
        console.warn(`[OS/${osChain}] "${col.slug}" — no floor price`);
      }
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
