import { AddressInfo } from 'node:net';
import { Server } from 'node:http';
import app from '../src/index.js';
import { prisma } from '../src/lib/prisma.js';

process.env.NODE_ENV = 'test';

export interface TestClient {
  server: Server;
  baseUrl: string;
  cookie?: string;
  close: () => Promise<void>;
  request: (
    path: string,
    options?: RequestInit & { cookie?: string }
  ) => Promise<{
    status: number;
    headers: Headers;
    body: any;
    cookie?: string;
  }>;
  get: (path: string, options?: RequestInit) => Promise<any>;
  post: (path: string, body?: any, options?: RequestInit) => Promise<any>;
  put: (path: string, body?: any, options?: RequestInit) => Promise<any>;
  patch: (path: string, body?: any, options?: RequestInit) => Promise<any>;
  delete: (path: string, options?: RequestInit) => Promise<any>;
}

export async function createTestClient(): Promise<TestClient> {
  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let lastCookie: string | undefined;

  const request = async (
    path: string,
    options: RequestInit & { cookie?: string } = {}
  ) => {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }
    const cookieToSend = options.cookie !== undefined ? options.cookie : lastCookie;
    if (cookieToSend) {
      headers.set('Cookie', cookieToSend);
    }

    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      if (setCookie.includes('auth_token=;') || setCookie.includes('Max-Age=0')) {
        lastCookie = undefined;
      } else {
        const tokenMatch = setCookie.match(/auth_token=[^;]+/);
        if (tokenMatch) {
          lastCookie = tokenMatch[0];
        }
      }
    }

    const text = await res.text();
    let body: any = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    return {
      status: res.status,
      headers: res.headers,
      body,
      cookie: lastCookie,
    };
  };

  const close = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };

  return {
    server,
    baseUrl,
    get cookie() {
      return lastCookie;
    },
    set cookie(val: string | undefined) {
      lastCookie = val;
    },
    close,
    request,
    get: (path, opts) => request(path, { ...opts, method: 'GET' }),
    post: (path, data, opts) =>
      request(path, {
        ...opts,
        method: 'POST',
        body: data !== undefined ? (typeof data === 'string' ? data : JSON.stringify(data)) : undefined,
      }),
    put: (path, data, opts) =>
      request(path, {
        ...opts,
        method: 'PUT',
        body: data !== undefined ? (typeof data === 'string' ? data : JSON.stringify(data)) : undefined,
      }),
    patch: (path, data, opts) =>
      request(path, {
        ...opts,
        method: 'PATCH',
        body: data !== undefined ? (typeof data === 'string' ? data : JSON.stringify(data)) : undefined,
      }),
    delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  };
}

export { prisma };
