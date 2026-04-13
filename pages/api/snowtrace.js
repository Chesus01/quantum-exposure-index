// pages/api/snowtrace.js
// Routescan free API for Avalanche - no key required
export default async function handler(req, res) {
  const params = new URLSearchParams(req.query);
  const chainId = params.get('chainid') || '43114';
  params.delete('chainid');
  params.delete('apikey');
  const url = `https://api.routescan.io/v2/network/mainnet/evm/${chainId}/etherscan/api?${params.toString()}`;
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = await r.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ status: '0', message: e.message, result: '0' });
  }
}