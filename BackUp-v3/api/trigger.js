// api/trigger.js — Vercel Serverless Function
// Menerima request dari frontend untuk trigger Pusher event.
// Endpoint: POST /api/trigger
// Body: { event: "antrian-updated" | "nilai-submitted", data: {...} }

const Pusher = require('pusher');

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || '2171350',
  key: process.env.PUSHER_KEY || '8eebb0f44e0e727467db',
  secret: process.env.PUSHER_SECRET || '58a31c3348c638019d82',
  cluster: process.env.PUSHER_CLUSTER || 'ap1',
  useTLS: true
});

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { event, data } = req.body || {};

    if (!event) {
      return res.status(400).json({ error: 'Missing event name' });
    }

    // Whitelist event names
    const allowed = ['antrian-updated', 'nilai-submitted'];
    if (!allowed.includes(event)) {
      return res.status(400).json({ error: 'Invalid event name' });
    }

    await pusher.trigger('pasanggiri', event, data || {});

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Pusher trigger error:', err);
    return res.status(500).json({ error: 'Failed to trigger event' });
  }
};
