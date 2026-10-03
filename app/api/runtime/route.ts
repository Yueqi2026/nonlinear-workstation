import { env } from "cloudflare:workers";

export async function GET() {
  return Response.json({
    aiConfigured: Boolean(env.AI_BASE_URL && env.QUICKROUTER_API_KEY && env.AI_MODEL),
    provider: "openai-compatible-chat-completions",
    model: env.AI_MODEL ?? null,
    mode: "server-controlled",
  });
}
