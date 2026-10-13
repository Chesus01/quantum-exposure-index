// Generates public/data/sample.json from synthetic Blend events.
// It runs the same decode -> lien state -> report pipeline as the live indexer,
// so it doubles as an offline test. Collection names and numbers are invented.
import { AbiCoder, keccak256, toUtf8Bytes } from "ethers";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { iface, applyLog, buildReport } from "./lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const addr = (s) => "0x" + keccak256(toUtf8Bytes(s)).slice(26);
const wei = (eth) => BigInt(Math.round(eth * 1e6)) * 10n ** 12n;

const cols = [
  { name: "Harbor Cats", floor: 9.2, n: 140, ltv: [0.55, 1.15] },
  { name: "Pixel Moles", floor: 3.1, n: 95, ltv: [0.7, 1.35] },
  { name: "Quiet Arcade", floor: 1.45, n: 120, ltv: [0.4, 1.05] },
  { name: "Lunar Kites", floor: 0.62, n: 70, ltv: [0.8, 1.5] },
  { name: "Oak Ledger", floor: 14.8, n: 38, ltv: [0.45, 0.98] },
  { name: "Tide Glyphs", floor: 0.21, n: 55, ltv: [0.6, 1.25] },
].map((c) => ({ ...c, address: addr(c.name) }));

function log(name, args, blockNumber, index) {
  const ev = iface.getEvent(name);
  const { data, topics } = iface.encodeEventLog(ev, args);
  return { data, topics, blockNumber, index };
}

const logs = [];
const NOW_BLOCK = 21_000_000;
const NOW_TS = Math.floor(Date.parse("2026-10-13T13:00:00Z") / 1000);
const blockTs = (b) => NOW_TS - (NOW_BLOCK - b) * 12;
let lienId = 1;
let idx = 0;
for (const c of cols) {
  for (let i = 0; i < c.n; i++) {
    const age = Math.floor(rnd() * 300_000); // up to ~6 weeks
    const b = NOW_BLOCK - age;
    const ltv = c.ltv[0] + rnd() * (c.ltv[1] - c.ltv[0]);
    const rate = Math.floor(200 + rnd() * 6000);
    logs.push(log("LoanOfferTaken", [keccak256(toUtf8Bytes(`o${lienId}`)), lienId, c.address, addr(`L${i % 9}`), addr(`B${lienId}`), wei(c.floor * ltv * 0.97), rate, i + 1, 9000], b, idx++));
    const r = rnd();
    if (r < 0.18) logs.push(log("Repay", [lienId, c.address], b + 500, idx++));
    else if (r < 0.26) logs.push(log("StartAuction", [lienId, c.address], b + 800, idx++));
    else if (r < 0.32) logs.push(log("Refinance", [lienId, c.address, addr("L99"), wei(c.floor * ltv), rate + 300, 9000], b + 1200, idx++));
    lienId++;
  }
}
logs.sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);

const liens = new Map();
for (const l of logs) applyLog(liens, l);
for (const l of liens.values()) l.startTs = blockTs(l.startBlock);

const floors = Object.fromEntries(cols.map((c) => [c.address, { name: c.name, floorEth: c.floor }]));
const report = buildReport([...liens.values()], floors, { nowTs: NOW_TS, block: NOW_BLOCK, deadlineIso: "2026-11-12T00:00:00Z" });
report.sample = true;

// Sanity checks so this script fails loudly if the pipeline breaks.
const expectedOpen = logs.filter((l) => l.topics[0] === iface.getEvent("LoanOfferTaken").topicHash).length
  - logs.filter((l) => l.topics[0] === iface.getEvent("Repay").topicHash).length;
if (report.totals.loanCount !== expectedOpen) throw new Error(`open count ${report.totals.loanCount} != ${expectedOpen}`);
for (const c of report.collections) {
  const b = Object.values(c.ltvBuckets).reduce((s, x) => s + x.count, 0);
  if (b !== c.loanCount) throw new Error(`bucket count mismatch in ${c.name}`);
  if (c.dropCurve[0].count !== c.underwaterCount) throw new Error(`drop curve mismatch in ${c.name}`);
}

await fs.mkdir(path.join(ROOT, "public", "data"), { recursive: true });
await fs.writeFile(path.join(ROOT, "public", "data", "sample.json"), JSON.stringify(report));
console.log("sample ok", report.totals);
