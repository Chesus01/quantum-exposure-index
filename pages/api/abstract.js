// pages/api/abstract.js
// Abscan API for Abstract Chain (chainId 2741) - Etherscan compatible
export default async function handler(req, res) {
  const params = new URLSearchParams(req.query);
  params.delete('chainid');
  const url = `https://api.abscan.org/api?${params.toString()}`;
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'QEI/1.0' } });
    const data = await r.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ status: '0', message: e.message, result: '0' });
  }
}