export default async function handler(req, res) {
  const { ids, vs_currencies = 'usd', include_market_cap = 'true', include_24hr_change = 'true' } = req.query;
  if (!ids) return res.status(400).json({ error: 'ids param required' });
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=' + ids + '&vs_currencies=' + vs_currencies + '&include_market_cap=' + include_market_cap + '&include_24hr_change=' + include_24hr_change;
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'QEI/1.0', 'Accept': 'application/json' } });
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'CoinGecko fetch failed', detail: err.message });
  }
}