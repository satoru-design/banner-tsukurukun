import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/_next', '/favicon.ico'];

// Edge runtime で動く constant-time 比較（Web API のみで実装）。
// `crypto.timingSafeEqual` は Node 専用なので使わない。
function safeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;

  // 本番では両方必須、未設定なら 503（フェイルクローズ）。
  // 開発環境のみ未設定で素通しを許可。
  if (!user || !pass) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('Auth misconfigured', { status: 503 });
    }
    return NextResponse.next();
  }

  const auth = req.headers.get('authorization') ?? '';
  const [scheme, encoded] = auth.split(' ');
  if (scheme === 'Basic' && encoded) {
    // atob は Web API（Edge runtime で動作）、Buffer は使わない
    let decoded = '';
    try {
      decoded = atob(encoded);
    } catch {
      // 不正な base64
    }
    const idx = decoded.indexOf(':');
    if (idx > 0) {
      const u = decoded.slice(0, idx);
      const p = decoded.slice(idx + 1);
      if (u && p && safeEq(u, user) && safeEq(p, pass)) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="banner-tsukurukun"',
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
