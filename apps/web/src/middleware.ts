import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function isTokenExpired(token: string): boolean {
  try {
    // JWT payload is the middle segment (header.payload.signature)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const exp = payload.exp;
    if (!exp) return false; // No expiry = treat as valid (永久 token)
    return Date.now() >= exp * 1000; // exp is in seconds, Date.now() is in ms
  } catch {
    return true; // Malformed token = treat as expired
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value || 
                request.cookies.get('access_token')?.value ||
                request.cookies.get('refreshToken')?.value ||
                request.cookies.get('refresh_token')?.value;

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith('/auth/login') || pathname.startsWith('/auth/register');

  if (pathname === '/auth/logout') {
    const response = NextResponse.redirect(new URL('/auth/login', request.url));
    response.cookies.delete('token');
    response.cookies.delete('access_token');
    response.cookies.delete('refreshToken');
    response.cookies.delete('refresh_token');
    return response;
  }

  // ── JWT Expiry Validation: Clear Stale Cookies Before Redirect ──
  if (token && isTokenExpired(token)) {
    const response = isAuthPage 
      ? NextResponse.next() 
      : NextResponse.redirect(new URL('/auth/login', request.url));
    response.cookies.delete('token');
    response.cookies.delete('access_token');
    response.cookies.delete('refreshToken');
    response.cookies.delete('refresh_token');
    return response;
  }

  // If already authenticated and trying to open login or setup, go directly to dashboard
  if (token && (isAuthPage || pathname === '/setup')) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/auth/login',
    '/auth/register',
    '/auth/logout',
    '/setup'
  ]
}

