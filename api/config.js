// api/config.js
// GET /api/config — configuración pública para el frontend

const IS_SANDBOX = process.env.NEXT_PUBLIC_PAYPAL_ENV === 'sandbox';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const paypalClientId = (IS_SANDBOX && process.env.PAYPAL_SANDBOX_CLIENT_ID) || process.env.PAYPAL_CLIENT_ID || '';

  return res.status(200).json({
    paypalClientId,
    sandbox: IS_SANDBOX,
    currency: 'USD',
  });
}
