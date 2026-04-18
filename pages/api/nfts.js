// NFT holdings scanner
// OpenSea v2  → Ethereum, Polygon, Arbitrum, Optimism, Base, Avalanche
// OpenSea SDK → Abstract ownership discovery (with V2 REST floor price enrichment)
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

// ── OpenSea V2 REST helper with 429 retry ──────────────────────────────────
async function openseaGet(path, apiKey, retries = 2) {
  const url = `https://api.opensea.io/api/v2${path}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'X-API-KEY': apiKey, accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
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

// ── Abstract: resolve contract address → collection slug ───────────────────
// Uses GET /api/v2/chain/abstract/contract/{address}
async function getAbstractContractCollection(contractAddress, apiKey) {
  console.log(`[Abstract/slug] looking up contract ${contractAddress}`);
  const data = await openseaGet(`/chain/abstract/contract/${contractAddress}`, apiKey);
  const slug = data?.collection;
  if (slug) {
    console.log(`[Abstract/slug] ${contractAddress} → "${slug}"`);
  } else {
    console.warn(`[Abstract/slug] ${contractAddress} → no slug returned (data: ${JSON.stringify(data)?.slice(0, 120)})`);
  }
  return slug || null;
}

// ── Abstract: fetch floor price for a known slug ───────────────────────────
// Uses GET /api/v2/collections/{slug}/stats
async function getAbstractCollectionStatsBySlug(slug, apiKey) {
  console.log(`[Abstract/stats] fetching stats for "${slug}"`);
  const data = await openseaGet(`/collections/${slug}/stats`, apiKey);
  const floor = data?.total?.floor_price || 0;
  if (floor > 0) {
    console.log(`[Abstract/stats] "${slug}" floor = ${floor} ETH`);
  } else {
    console.warn(`[Abstract/stats] "${slug}" → no floor price (data: ${JSON.stringify(data)?.slice(0, 120)})`);
  }
  return floor;
}

// ── Abstract: enrich a collection list with floor prices via V2 REST ───────
// Each collection must have at least: { slug?, contractAddress?, name, image, count }
// Mutates in place, also returns the array.
async function enrichAbstractCollectionsWithFloorPrices(collections, apiKey, ethUsd) {
  await Promise.all(collections.map(async col => {
    try {
      // Step 1: resolve slug via contract lookup if we don't already have one
      if (!col.slug && col.contractAddress) {
        console.log(`[Abstract/enrich] no slug for "${col.name}" — trying contract lookup`);
        col.slug = await getAbstractContractCollection(col.contractAddress, apiKey);
      }

      // Step 2: fetch floor price if we have a slug
      if (col.slug) {
        const floorEth = await getAbstractCollectionStatsBySlug(col.slug, apiKey);
        col.floorEth = floorEth;
        col.floorUsd = floorEth * ethUsd;
      } else {
        console.warn(`[Abstract/enrich] "${col.name}" (${col.contractAddress}) — slug unresolvable, floor = 0`);
        col.floorEth = 0;
        col.floorUsd = 0;
      }
    } catch (e) {
      console.warn(`[Abstract/enrich] error on "${col.name}": ${e.message}`);
      col.floorEth = 0;
      col.floorUsd = 0;
    }
    col.totalUsd = (col.floorUsd || 0) * col.count;
  }));
  return collections;
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

// ── Abstract via Blockscout explorer (ownership only — no floor prices here)
// Floor prices are enriched separately via OpenSea V2 REST after grouping.
async function abstractNFTsBlockscout(address, apiKey) {
  console.log('[Abstract/Blockscout] fetching ownership data');
  const r = await fetch(
    `https://explorer.abstract.network/api/v2/addresses/${address}/nft?type=ERC-721%2CERC-1155&limit=100`,
    { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
  );
  if (!r.ok) throw new Error(`Abstract Explorer ${r.status}`);
  const data = await r.json();

  console.log(`[Abstract/Blockscout] ${(data.items || []).length} NFT items found`);

  const byCol = {};
  for (const item of data.items || []) {
    const contractAddress = item.token?.address || null;
    const key = contractAddress || 'unknown';
    const colName = item.token?.name || (contractAddress ? `${contractAddress.slice(0, 8)}…` : 'Unknown');
    const image   = item.image_url || item.metadata?.image || null;
    if (!byCol[key]) byCol[key] = { slug: null, contractAddress, name: colName, image, count: 0 };
    byCol[key].count++;
    if (!byCol[key].image && image) byCol[key].image = image;
  }

  const top = Object.values(byCol)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Enrich with floor prices via OpenSea V2 REST (contract lookup → slug → stats)
  if (apiKey) {
    const ethUsd = await coinPrice('ethereum');
    await enrichAbstractCollectionsWithFloorPrices(top, apiKey, ethUsd);
  } else {
    top.forEach(col => { col.floorEth = 0; col.floorUsd = 0; col.totalUsd = 0; });
  }

  return top;
}

// ── Abstract: SDK for ownership discovery, V2 REST for floor prices ─────────
async function abstractNFTs(address, apiKey) {
  const { OpenSeaSDK, Chain } = await import('@opensea/sdk');
  const { JsonRpcProvider } = await import('ethers');

  const alchemyKey = process.env.ALCHEMY_API_KEY || '';
  const rpcUrl     = alchemyKey
    ? `https://abstract-mainnet.g.alchemy.com/v2/${alchemyKey}`
    : 'https://api.mainnet.abs.xyz';

  const provider = new JsonRpcProvider(rpcUrl);
  const sdk = new OpenSeaSDK(provider, { chain: Chain.Abstract, apiKey });

  // 1. Ownership discovery via SDK — fall back to Blockscout if SDK fails/empty
  let allNfts = [];
  try {
    console.log('[Abstract/SDK] fetching NFTs by account');
    const page1 = await sdk.api.getNFTsByAccount(address, 100, undefined, Chain.Abstract);
    allNfts = page1.nfts || [];
    if (page1.next && allNfts.length === 100) {
      try {
        const page2 = await sdk.api.getNFTsByAccount(address, 100, page1.next, Chain.Abstract);
        allNfts = allNfts.concat(page2.nfts || []);
      } catch (e) {
        console.warn('[Abstract/SDK] pagination error (ignored):', e.message);
      }
    }
    console.log(`[Abstract/SDK] ownership discovery returned ${allNfts.length} NFTs`);
  } catch (e) {
    console.warn('[Abstract/SDK] ownership discovery failed — falling back to Blockscout:', e.message);
    return abstractNFTsBlockscout(address, apiKey);
  }

  if (allNfts.length === 0) {
    console.warn('[Abstract/SDK] 0 NFTs returned — falling back to Blockscout');
    return abstractNFTsBlockscout(address, apiKey);
  }

  // 2. Group by collection slug; also capture contractAddress for slug resolution fallback
  const byCol = {};
  for (const n of allNfts) {
    const slug            = n.collection || null;
    const contractAddress = n.contract   || null;
    const key = slug || contractAddress || 'unknown';
    if (!byCol[key]) {
      byCol[key] = {
        slug,
        contractAddress,
        name:  slug ? slug2name(slug) : (contractAddress ? `${contractAddress.slice(0, 8)}…` : 'Unknown'),
        image: null,
        count: 0,
      };
    }
    byCol[key].count++;
    if (!byCol[key].image && n.image_url) byCol[key].image = n.image_url;
    // If we grouped by contractAddress and later encounter a slug, capture it
    if (!byCol[key].slug && slug) {
      byCol[key].slug = slug;
      byCol[key].name = slug2name(slug);
    }
  }

  const top = Object.values(byCol).sort((a, b) => b.count - a.count).slice(0, 15);

  // 3. Floor price enrichment via OpenSea V2 REST — replaces sdk.api.getCollectionStats
  const ethUsd = await coinPrice('ethereum');
  await enrichAbstractCollectionsWithFloorPrices(top, apiKey, ethUsd);

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
      const apiKey = process.env.OPENSEA_API_KEY || '';
      if (!apiKey) {
        console.warn('[Abstract] OPENSEA_API_KEY not set — floor prices will be 0');
      }
      collections = await abstractNFTs(address, apiKey);
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
