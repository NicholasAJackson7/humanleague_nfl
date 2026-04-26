import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { devAuthApiPlugin } from './vite.dev-auth-api.js';

/**
 * Plain `npm run dev` does not run Vercel serverless functions. Without this,
 * GET /api/* can fall through and Vite serves the raw `api/*.js` source, which
 * breaks `response.json()` in the browser with "is not valid JSON".
 */
function apiNotOnViteOnly() {
  return {
    name: 'api-not-on-vite-only',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0];
        if (path.startsWith('/api/auth/')) {
          return next();
        }
        if (path.startsWith('/api/')) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              error:
                'API routes are not served by Vite alone. Stop `npm run dev` and run `npx vercel dev` instead (see README). Your DATABASE_URL in .env is only used when the API actually runs.',
            })
          );
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  return {
    plugins: [devAuthApiPlugin(mode), apiNotOnViteOnly(), react()],
    server: {
      port: 5173,
    },
  };
});
