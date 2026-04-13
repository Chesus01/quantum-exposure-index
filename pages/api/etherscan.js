export default async function handler(req, res) {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });
  const params = new URLSearchParams(req.query);
  params.set('apikey', apiKey);
  const url = 'https://api.etherscan.io/v2/api?' + params.toString();
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'QEI/1.0' } });
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Upstream fetch failed', detail: err.message });
  }
}