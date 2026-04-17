// SSL Labs API proxy — scans any public domain for TLS/cipher details
// Free, no API key required. Results cached 10 minutes.
const cache = {};
const CACHE_TTL = 600000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const host = (req.query.host || '').replace(/https?:\/\//i, '').split('/')[0].trim();
  if (!host) return res.status(400).json({ error: 'host param required' });

  const now = Date.now();
  if (cache[host] && now - cache[host].ts < CACHE_TTL) {
    return res.status(200).json(cache[host].data);
  }

  try {
    // Start or retrieve analysis (fromCache=on reuses recent scans, all=on gets all endpoints)
    const url = `https://api.ssllabs.com/api/v3/analyze?host=${encodeURIComponent(host)}&fromCache=on&all=done&ignoreMismatch=on`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'QEI/1.0 (quantumexposureindex.vercel.app)' },
      signal: AbortSignal.timeout(12000)
    });
    if (!r.ok) throw new Error(`SSL Labs returned ${r.status}`);
    const data = await r.json();

    // Parse into a clean summary
    const summary = parseSslResult(data);
    cache[host] = { data: summary, ts: now };
    res.status(200).json(summary);
  } catch (e) {
    res.status(200).json({ error: e.message, host, status: 'unavailable' });
  }
}

function parseSslResult(d) {
  const out = {
    host: d.host,
    status: d.status, // DNS, IN_PROGRESS, READY, ERROR
    grade: null,
    protocols: [],
    keyType: null,
    keyBits: null,
    sigAlg: null,
    quantumRisk: null,
    summary: null,
  };

  if (d.status !== 'READY' || !d.endpoints?.length) return out;

  const ep = d.endpoints[0];
  out.grade = ep.grade || null;

  const det = ep.details;
  if (!det) return out;

  // Protocols in use
  if (det.protocols) {
    out.protocols = det.protocols.map(p => p.name + ' ' + p.version);
  }

  // Certificate key info
  if (det.cert) {
    out.keyType = det.cert.keyAlg || null;   // RSA, EC, etc.
    out.keyBits = det.cert.keySize || null;
    out.sigAlg  = det.cert.sigAlg  || null;
  } else if (det.certChains?.[0]?.certIds) {
    // v3 API structure
    const leaf = det.certChains[0];
    out.keyType = leaf.keyAlg || null;
    out.keyBits = leaf.keySize || null;
    out.sigAlg  = leaf.sigAlg || null;
  }

  // Quantum risk assessment from TLS data
  const kt = (out.keyType || '').toUpperCase();
  const kb = out.keyBits || 0;
  const sa = (out.sigAlg || '').toLowerCase();
  const protos = out.protocols.join(' ').toLowerCase();

  if (sa.includes('dilithium') || sa.includes('kyber') || sa.includes('ml-dsa') || sa.includes('ml-kem')) {
    out.quantumRisk = 'low';
    out.summary = `Post-quantum signature detected (${out.sigAlg}). Already migrating.`;
  } else if (kt === 'RSA' && kb >= 2048) {
    out.quantumRisk = 'high';
    out.summary = `RSA-${kb} key. Directly broken by Shor's algorithm. No PQC detected.`;
  } else if (kt === 'EC' || kt === 'ECDSA') {
    out.quantumRisk = 'high';
    out.summary = `ECDSA ${kb}-bit key. Vulnerable to Shor's algorithm on elliptic curves.`;
  } else if (kt === 'RSA' && kb < 2048) {
    out.quantumRisk = 'critical';
    out.summary = `Weak RSA-${kb} key. Vulnerable classically and to quantum attack.`;
  } else if (protos.includes('tls 1.3')) {
    out.quantumRisk = 'moderate';
    out.summary = 'TLS 1.3 in use. Key exchange details not fully resolved.';
  } else {
    out.quantumRisk = 'unknown';
    out.summary = 'TLS data retrieved but key type could not be determined.';
  }

  return out;
}
