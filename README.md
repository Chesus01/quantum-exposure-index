# Blend Watch

Tracks every open loan on Blur's Blend lending protocol and shows, per collection, how much of it is underwater (debt greater than the floor price). Built for the window before Blend stops matching loans on November 12, 2026.

## What's in here

| Path | What it does |
| --- | --- |
| `indexer/lib.mjs` | Decodes Blend events, rebuilds open liens, computes current debt, builds the report |
| `indexer/index.mjs` | Live indexer: scans mainnet, prices collections, writes `public/data/loans.json` |
| `indexer/sample.mjs` | Offline test with invented data, writes `public/data/sample.json` |
| `public/index.html` | The site. Reads `data/loans.json`, falls back to `data/sample.json` |
| `floors.override.json` | Manual names or floor prices per collection address |
| `.github/workflows/update.yml` | Refreshes data every 30 minutes; Vercel redeploys on each push |
| `vercel.json` | Serves `public/` as a static site |

## How the numbers work

Blend (proxy `0x29469395eAf6f95920E59F858042f0e28D98a20B`) only stores a hash of each loan on chain, so the indexer rebuilds loans from events:

* `LoanOfferTaken` opens a lien
* `Refinance` replaces lender, amount and rate, and restarts interest
* `StartAuction` marks the loan as called
* `Repay`, `Seize`, `BuyLocked` close it

Debt = principal × e^(APR × years since start or last refinance), matching Blend's continuous interest. During a refinancing auction the on-chain rate can rise, so those loans may owe slightly more than shown. Floor prices come from the OpenSea API.

## Run it locally

```bash
npm install
npm run sample                  # offline preview data
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/KEY \
OPENSEA_API_KEY=KEY npm run index
npm run serve                   # http://localhost:4173
```

The first scan covers every block since May 2023 and takes a while on a free RPC plan. Progress is checkpointed to `data/state.json`, and later runs only scan new blocks.

## Deploy (Vercel)

This repo is already linked to the Vercel project `quantum-exposure-index`, so every push to `main` deploys.

1. GitHub repo → Settings → Secrets and variables → Actions: add `RPC_URL` (Alchemy or Infura mainnet) and `OPENSEA_API_KEY`.
2. Actions tab → run "Refresh Blend loan data" once. After that it runs every 30 minutes.
3. Until the first run finishes, the site shows the labeled sample data.

The previous Quantum Exposure Index site is saved on the `archive/quantum-exposure-index` branch.

## Linking to a collection

Append the collection address as the hash: `yoursite.xyz/#0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d`. Good for posting a specific collection's waterline on X.
