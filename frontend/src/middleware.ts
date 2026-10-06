import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function decodeJwtPayload(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // Base64Url to Base64
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    // Pad with '='
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
    
    const decoded = atob(padded);
    // decodeURIComponent(escape()) handles UTF-8 characters safely
    return JSON.parse(decodeURIComponent(escape(decoded)));
  } catch (error) {
    console.error('Error decoding JWT payload in middleware:', error);
    return null;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('accessToken')?.value || request.cookies.get('token')?.value;
  const path = request.nextUrl.pathname;
  const isAuthPage = path.startsWith('/login') || path.startsWith('/register');
  
  // Public paths that don't need protection
  if (path === '/' || path.startsWith('/_next') || path.startsWith('/api') || path.startsWith('/favicon.ico')) {
    return NextResponse.next();
  }

  // No token => redirect to login
  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Has token
  if (token) {
    const payload = decodeJwtPayload(token);
    
    // If token is invalid or expired
    if (!payload) {
      if (!isAuthPage) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
      return NextResponse.next();
    }

    const role = payload.role || 'GUEST';
    
    const isAdvancedUser = role === 'SUPER_OWNER' || role === 'ADMIN';
    const isRestrictedUser = role === 'MEMBER' || role === 'RESTRICTED' || role === 'GUEST';

    // Logged in user hitting login page -> redirect based on role
    if (isAuthPage) {
      if (isAdvancedUser) return NextResponse.redirect(new URL('/dashboard', request.url));
      if (isRestrictedUser) return NextResponse.redirect(new URL('/home', request.url));
    }

    // Role-based Path Protection
    if (path.startsWith('/dashboard') && isRestrictedUser) {
      // Restricted users cannot access /dashboard
      return NextResponse.redirect(new URL('/home', request.url));
    }

    if (path.startsWith('/home') && isAdvancedUser) {
      // Advanced users are typically redirected to dashboard
      // But we might want them to see /home as well if they want, 
      // though typically they use /dashboard. We can just let them pass or redirect.
      // Let's redirect them to dashboard to avoid confusion.
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
