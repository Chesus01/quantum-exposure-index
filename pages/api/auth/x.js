// Exchanges X OAuth 2.0 authorization code for a minimal user profile.
// Scopes requested: tweet.read users.read  (absolute minimum)
// Returns: { username, name, avatar }  — no tokens stored server-side.

const REDIRECT_URI = 'https://quantum-exposure-index.vercel.app/app.html';

export default async function handler(req, res) {
  const { code, code_verifier } = req.query;
  if (!code || !code_verifier) {
    return res.status(400).json({ error: 'Missing code or code_verifier' });
  }

  const clientId     = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'X credentials not configured' });
  }

  // Exchange code → access token
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basic}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      code_verifier,
    }).toString(),
  });

  const token = await tokenRes.json();
  if (!token.access_token) {
    console.error('X token exchange failed:', token);
    return res.status(400).json({ error: 'Token exchange failed' });
  }

  // Fetch minimal profile — only the fields we actually use
  const profileRes = await fetch(
    'https://api.twitter.com/2/users/me?user.fields=profile_image_url,username,name',
    { headers: { Authorization: `Bearer ${token.access_token}` } }
  );

  const profile = await profileRes.json();
  if (!profile.data) {
    return res.status(400).json({ error: 'Could not fetch profile' });
  }

  const { username, name, profile_image_url } = profile.data;

  // Upgrade avatar from 48px (_normal) to 73px (_bigger) for card display
  const avatar = (profile_image_url || '').replace('_normal', '_bigger');

  // Return only the minimum needed — no access token sent to client
  res.json({ username, name, avatar });
}
