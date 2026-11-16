declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_BOT_ID?: string;
    PILOT_METRICS_ENABLED?: string;
    PILOT_ADMIN_EMAIL?: string;
    BUCKET?: R2Bucket;
  }
}
