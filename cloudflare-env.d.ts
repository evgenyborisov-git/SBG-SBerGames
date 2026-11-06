declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_BOT_ID?: string;
    BUCKET?: R2Bucket;
  }
}
