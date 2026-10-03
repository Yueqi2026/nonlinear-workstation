declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    AI_BASE_URL?: string;
    QUICKROUTER_API_KEY?: string;
    AI_MODEL?: string;
  }
}
