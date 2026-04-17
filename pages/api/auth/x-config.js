// Returns only the public client ID — no secret exposed
export default function handler(req, res) {
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'X_CLIENT_ID not configured' });
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.json({ clientId });
}
