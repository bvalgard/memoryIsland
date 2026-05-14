const FIREBASE_PROJECT_ID = 'memory-islands-1a30d';
const R2_PUBLIC_URL = 'https://pub-5b1f19ee370d46ccb357888d13130b96.r2.dev';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

async function verifyFirebaseToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');

  const decode = (str) => {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  };

  const header = decode(parts[0]);
  const payload = decode(parts[1]);

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) throw new Error('Token expired');
  if (payload.aud !== FIREBASE_PROJECT_ID) throw new Error('Invalid audience');
  if (payload.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) throw new Error('Invalid issuer');
  if (!payload.sub) throw new Error('Missing subject');

  const jwksRes = await fetch(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'
  );
  const jwks = await jwksRes.json();
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Signing key not found');

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signedPart = `${parts[0]}.${parts[1]}`;
  const sigB64 = parts[2].replace(/-/g, '+').replace(/_/g, '/');
  const sigPadded = sigB64 + '='.repeat((4 - (sigB64.length % 4)) % 4);
  const signature = Uint8Array.from(atob(sigPadded), (c) => c.charCodeAt(0));

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature,
    new TextEncoder().encode(signedPart)
  );

  if (!valid) throw new Error('Invalid signature');
  return payload;
}

async function handleUpload(request, env) {
  const formData = await request.formData();
  const file = formData.get('file');
  const token = formData.get('token');

  if (!file || !token) {
    return json({ error: 'Missing file or token' }, 400);
  }

  let payload;
  try {
    payload = await verifyFirebaseToken(String(token));
  } catch (e) {
    return json({ error: `Unauthorized: ${e.message}` }, 401);
  }

  const contentType = file.type;
  if (!contentType.startsWith('image/')) {
    return json({ error: 'Only image files are allowed' }, 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
    return json({ error: 'File exceeds 5MB limit' }, 400);
  }

  const ext = contentType.split('/')[1].replace('jpeg', 'jpg').split(';')[0];
  const uuid = crypto.randomUUID();
  const objectKey = `users/${payload.sub}/${uuid}.${ext}`;

  await env.MEDIA_BUCKET.put(objectKey, arrayBuffer, {
    httpMetadata: { contentType },
  });

  return json({ url: `${R2_PUBLIC_URL}/${objectKey}` });
}

async function handleDelete(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  let payload;
  try {
    payload = await verifyFirebaseToken(token);
  } catch (e) {
    return json({ error: `Unauthorized: ${e.message}` }, 401);
  }

  const body = await request.json();
  const { url } = body;
  if (!url || !url.startsWith(R2_PUBLIC_URL + '/')) {
    return json({ error: 'Invalid URL' }, 400);
  }

  const objectKey = url.slice(R2_PUBLIC_URL.length + 1);

  // Enforce that users can only delete their own objects
  if (!objectKey.startsWith(`users/${payload.sub}/`)) {
    return json({ error: 'Forbidden' }, 403);
  }

  await env.MEDIA_BUCKET.delete(objectKey);
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      if (request.method === 'POST') return handleUpload(request, env);
      if (request.method === 'DELETE') return handleDelete(request, env);
      return json({ error: 'Method not allowed' }, 405);
    } catch {
      return json({ error: 'Internal server error' }, 500);
    }
  },
};
