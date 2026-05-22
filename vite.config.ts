import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

function apiDevPlugin() {
  return {
    name: 'api-dev-server',
    configureServer(server: any) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url?.startsWith('/api/')) return next();

        const urlPath = req.url.split('?')[0];
        const handlerPath = path.resolve(process.cwd(), `.${urlPath}.ts`);

        try {
          const mod = await server.ssrLoadModule(handlerPath);
          const handler = mod.default;
          if (typeof handler !== 'function') return next();

          const url = new URL(req.url, 'http://localhost');
          const query: Record<string, string> = {};
          url.searchParams.forEach((v, k) => { query[k] = v; });

          let body: unknown = null;
          if (req.method === 'POST' || req.method === 'PUT') {
            body = await new Promise((resolve) => {
              let data = '';
              req.on('data', (chunk) => { data += chunk; });
              req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
            });
          }

          const vercelReq = { method: req.method, query, headers: req.headers, body };

          let statusCode = 200;
          const resHeaders: Record<string, string> = {};
          let sent = false;

          const vercelRes = {
            status(code: number) { statusCode = code; return vercelRes; },
            setHeader(key: string, val: string) { resHeaders[key] = val; return vercelRes; },
            json(data: unknown) {
              if (sent) return vercelRes;
              sent = true;
              resHeaders['Content-Type'] = 'application/json';
              res.writeHead(statusCode, resHeaders);
              res.end(JSON.stringify(data));
              return vercelRes;
            },
            send(data: unknown) {
              if (sent) return vercelRes;
              sent = true;
              res.writeHead(statusCode, resHeaders);
              res.end(typeof data === 'string' ? data : JSON.stringify(data));
              return vercelRes;
            },
            end() {
              if (sent) return vercelRes;
              sent = true;
              res.writeHead(statusCode, resHeaders);
              res.end();
              return vercelRes;
            },
          };

          await handler(vercelReq, vercelRes);
        } catch (err: any) {
          if (err?.code === 'ERR_MODULE_NOT_FOUND' || err?.message?.includes('ENOENT')) {
            return next();
          }
          console.error('[api-dev-server]', err);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Expose all .env vars to process.env so API handlers can read them at dev time
  Object.assign(process.env, env);

  return {
    plugins: [react(), tailwindcss(), apiDevPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
