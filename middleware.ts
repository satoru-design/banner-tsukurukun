import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

const PUBLIC_PATHS = ['/_next', '/favicon.ico'];

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
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
    const [u, p] = Buffer.from(encoded, 'base64').toString().split(':');
    if (u && p && safeEq(u, user) && safeEq(p, pass)) {
      return NextResponse.next();
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
