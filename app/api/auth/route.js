/**
 * Simple Authentication API
 * POST /api/auth - Login with username/password
 * GET /api/auth - Check authentication status
 * DELETE /api/auth - Logout
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Simple token generation (in production, use proper JWT)
function generateToken() {
  return Buffer.from(Date.now().toString() + Math.random().toString()).toString('base64');
}

// Validate credentials
function validateCredentials(username, password) {
  const validUsername = process.env.AUTH_USERNAME;
  const validPassword = process.env.AUTH_PASSWORD;

  if (!validUsername || !validPassword) {
    console.error('[Auth] AUTH_USERNAME or AUTH_PASSWORD not configured');
    return false;
  }

  return username === validUsername && password === validPassword;
}

/**
 * POST - Login
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password required' },
        { status: 400 }
      );
    }

    if (!validateCredentials(username, password)) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Generate session token
    const token = generateToken();

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Also store token server-side for validation (simple in-memory for now)
    // In production, use Redis or database
    global.authTokens = global.authTokens || new Set();
    global.authTokens.add(token);

    console.log('[Auth] User logged in successfully');

    return NextResponse.json({
      success: true,
      message: 'Logged in successfully',
    });

  } catch (error) {
    console.error('[Auth] Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  }
}

/**
 * GET - Check auth status
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false });
    }

    // Validate token
    global.authTokens = global.authTokens || new Set();
    const isValid = global.authTokens.has(token);

    return NextResponse.json({ authenticated: isValid });

  } catch (error) {
    console.error('[Auth] Check error:', error);
    return NextResponse.json({ authenticated: false });
  }
}

/**
 * DELETE - Logout
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (token) {
      // Remove token from valid tokens
      global.authTokens = global.authTokens || new Set();
      global.authTokens.delete(token);
    }

    // Clear cookie
    cookieStore.delete('auth_token');

    console.log('[Auth] User logged out');

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });

  } catch (error) {
    console.error('[Auth] Logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Logout failed' },
      { status: 500 }
    );
  }
}
