import type { CorsOptions } from 'cors';
import { appConfig } from '../config/env';

/**
 * Production: only allow listed origins (CORS_ORIGINS).
 * Non-prod: reflect request origin (local dashboards on any port).
 */
export function buildCorsOptions(): CorsOptions {
  const allowed = new Set(appConfig.corsOrigins);

  if (appConfig.isProd) {
    if (allowed.size === 0) {
      console.warn(
        '⚠ CORS_ORIGINS is empty in production — browser cross-origin calls will be blocked.',
      );
    }
    return {
      origin(origin, callback) {
        // Non-browser / same-origin tools (curl, server-side) send no Origin
        if (!origin) {
          callback(null, true);
          return;
        }
        if (allowed.has(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
    };
  }

  return {
    origin: true,
    credentials: true,
  };
}
