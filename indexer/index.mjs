// Blend Watch indexer.
// 1. Scans Blend lifecycle events from mainnet (incremental, cached in data/state.json)
// 2. Rebuilds every open lien
// 3. Pulls floor prices (OpenSea API, with manual overrides in floors.override.json)
// 4. Writes public/data/loans.json for the site
//
// Env:
//   RPC_URL           required. Any Ethereum mainnet RPC (Alchemy, Infura, QuickNode, your own node).
//   OPENSEA_API_KEY   optional but recommended. Without it only overrides are used for floors.
//   LOG_CHUNK         optional. Block range per eth_getLogs call (default 5000).
import { JsonRpcProvider } from "ethers";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BLEND_ADDRESS, BLEND_START_BLOCK, ALL_TOPICS, applyLog, buildReport } from "./lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE_FILE = path.join(ROOT, "data", "state.json");
const OVERRIDES_FILE = path.join(ROOT, "floors.override.json");
const OUT_FILE = path.join(ROOT, "public", "data", "loans.json");
const DEADLINE = "2026-11-12T00:00:00Z"; // Blend stops matching new loans; blur.io goes offline

const RPC_URL = process.env.RPC_URL;
if (!RPC_URL) {
  console.error("Set RPC_URL to an Ethereum mainnet RPC endpoint.");
  process.exit(1);
}
const provider = new JsonRpcProvider(RPC_URL, 1, { staticNetwork: true });
let CHUNK = Number(process.env.LOG_CHUNK || 5000);

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return fallback; }
}
async function writeJson(file, obj) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(obj));
}

async function getLogsRange(from, to) {
  // Shrink the range automatically when the provider rejects it as too large.
  try {
    return await provider.getLogs({ address: BLEND_ADDRESS, topics: [ALL_TOPICS], fromBlock: from, toBlock: to });
  } catch (err) {
    if (to - from < 50) throw err;
    const mid = Math.floor((from + to) / 2);
    CHUNK = Math.max(500, Math.floor(CHUNK / 2));
    return [...(await getLogsRange(from, mid)), ...(await getLogsRange(mid + 1, to))];
  }
}

async function scan(state) {
  const head = (await provider.getBlockNumber()) - 3; // small reorg buffer
  const liens = new Map(Object.entries(state.liens || {}));
  let from = (state.lastBlock ?? BLEND_START_BLOCK - 1) + 1;
  console.log(`Scanning blocks ${from} to ${head} (${liens.size} open liens cached)`);
  while (from <= head) {
    const to = Math.min(from + CHUNK - 1, head);
    const logs = await getLogsRange(from, to);
    logs.sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);
    for (const log of logs) applyLog(liens, log);
    process.stdout.write(`\r  block ${to}  open liens ${liens.size}   `);
    from = to + 1;
    // Checkpoint periodically so a crash does not lose a long first scan.
    if ((to - BLEND_START_BLOCK) % (CHUNK * 50) < CHUNK) {
      await writeJson(STATE_FILE, { ...state, lastBlock: to, liens: Object.fromEntries(liens) });
    }
  }
  process.stdout.write("\n");
  return { head, liens };
}

async function fillTimestamps(liens, tsCache) {
  const need = [...new Set([...liens.values()].map((l) => l.startBlock))].filter((b) => !tsCache[b]);
  console.log(`Fetching ${need.length} block timestamps`);
  const BATCH = 20;
  for (let i = 0; i < need.length; i += BATCH) {
    const slice = need.slice(i, i + BATCH);
    const blocks = await Promise.all(slice.map((b) => provider.getBlock(b)));
    blocks.forEach((blk, j) => { tsCache[slice[j]] = blk.timestamp; });
  }
  for (const l of liens.values()) l.startTs = tsCache[l.startBlock];
}

async function opensea(pathname) {
  const res = await fetch(`https://api.opensea.io/api/v2${pathname}`, {
    headers: { accept: "application/json", "x-api-key": process.env.OPENSEA_API_KEY },
  });
  if (!res.ok) throw new Error(`OpenSea ${res.status} for ${pathname}`);
  return res.json();
}

async function fetchFloors(addresses, metaCache) {
  const overrides = await readJson(OVERRIDES_FILE, {});
  const floors = {};
  for (const addr of addresses) {
    const o = overrides[addr] || {};
    const meta = metaCache[addr] || {};
    let floorEth = null;
    if (process.env.OPENSEA_API_KEY) {
      try {
        if (!meta.slug) {
          const c = await opensea(`/chain/ethereum/contract/${addr}`);
          meta.slug = c.collection;
          const info = await opensea(`/collections/${meta.slug}`);
          meta.name = info.name;
          meta.image = info.image_url;
          metaCache[addr] = meta;
        }
        const stats = await opensea(`/collections/${meta.slug}/stats`);
        floorEth = stats?.total?.floor_price ?? null;
      } catch (e) {
        console.warn(`  floor lookup failed for ${addr}: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 250)); // stay under rate limits
    }
    floors[addr] = {
      name: o.name || meta.name,
      slug: meta.slug,
      image: meta.image,
      floorEth: typeof o.floorEth === "number" ? o.floorEth : floorEth,
    };
  }
  return floors;
}

const state = await readJson(STATE_FILE, {});
const { head, liens } = await scan(state);
state.tsCache ||= {};
state.meta ||= {};
await fillTimestamps(liens, state.tsCache);

// Drop timestamps for liens that no longer exist so state.json stays small.
const live = new Set([...liens.values()].map((l) => String(l.startBlock)));
for (const b of Object.keys(state.tsCache)) if (!live.has(b)) delete state.tsCache[b];

const collections = [...new Set([...liens.values()].map((l) => l.collection))];
console.log(`Pricing ${collections.length} collections`);
const floors = await fetchFloors(collections, state.meta);

const headBlock = await provider.getBlock(head);
const report = buildReport([...liens.values()], floors, { nowTs: headBlock.timestamp, block: head, deadlineIso: DEADLINE });
await writeJson(OUT_FILE, report);
await writeJson(STATE_FILE, { ...state, lastBlock: head, liens: Object.fromEntries(liens) });

const t = report.totals;
console.log(`Done. ${t.loanCount} open loans, ${t.totalDebt.toFixed(2)} ETH debt, ${t.underwaterCount} underwater (${t.underwaterDebt.toFixed(2)} ETH).`);
