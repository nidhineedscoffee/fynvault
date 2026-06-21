import { NextResponse } from "next/server";
import { DataSourceConnectSchema, connectDataSource } from "@/lib/consent";
import { serviceResponse } from "@/lib/api-response";
import { enforceRateLimit, getClientIp, isTrustedOrigin } from "@/lib/security";
import { requireClientAccess } from "@/lib/workspace-auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Untrusted origin." }, { status: 403 });
  }

  const limit = enforceRateLimit({ scope: "data_source_connect", key: getClientIp(request), limit: 20, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Please retry shortly." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = DataSourceConnectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request payload.", issues: parsed.error.issues }, { status: 400 });
  }

  const { id } = await context.params;
  const access = await requireClientAccess(request, id);
  if (!access.ok) return serviceResponse(access);

  return serviceResponse(await connectDataSource(id, { ...parsed.data, firmId: access.firmId }));
}
