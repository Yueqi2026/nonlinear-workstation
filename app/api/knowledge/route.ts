import { addKnowledge, listKnowledge, ownerFromHeaders, removeKnowledge } from "../../../db/workstation";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "知识库请求失败。";
}

export async function GET(request: Request) {
  try {
    const documents = await listKnowledge(ownerFromHeaders(request.headers));
    return Response.json({ documents });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { title?: string; content?: string; tags?: string[] };
    const title = payload.title?.trim().slice(0, 160) ?? "";
    const content = payload.content?.trim().slice(0, 12000) ?? "";
    const tags = (payload.tags ?? []).filter((tag) => typeof tag === "string").map((tag) => tag.trim().slice(0, 40)).filter(Boolean).slice(0, 12).join(", ");
    if (!title || !content) return Response.json({ error: "标题和内容均为必填项。" }, { status: 400 });
    await addKnowledge({ id: crypto.randomUUID(), ownerId: ownerFromHeaders(request.headers), title, content, tags });
    const documents = await listKnowledge(ownerFromHeaders(request.headers));
    return Response.json({ documents }, { status: 201 });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
    if (!id) return Response.json({ error: "缺少知识条目 id。" }, { status: 400 });
    const ownerId = ownerFromHeaders(request.headers);
    await removeKnowledge(ownerId, id);
    const documents = await listKnowledge(ownerId);
    return Response.json({ documents });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 503 });
  }
}
