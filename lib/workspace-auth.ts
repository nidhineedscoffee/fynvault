import { createSupabaseServerClient } from "./supabase";
import { scalekitCookieNames } from "./scalekit";
import { isUuid } from "./mvp";

type ServiceFailure = { ok: false; status: number; error: string };
type SessionUser = { id: string; email?: string; name?: string };
type FirmSession = { ok: true; user: SessionUser; firmId: string } | ServiceFailure;
type ClientAccess = { ok: true; user: SessionUser; firmId: string; clientId: string } | ServiceFailure;
type JobAccess = { ok: true; user: SessionUser; firmId: string; jobId: string } | ServiceFailure;
type RowAccess = { ok: true; user: SessionUser; firmId: string; id: string } | ServiceFailure;

function fail(status: number, error: string): ServiceFailure {
  return { ok: false, status, error };
}

function readCookie(request: Request, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`))?.[1];
}

function decodeJwtPayload(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getSessionUser(request: Request): SessionUser | null {
  const sessionCookie = readCookie(request, scalekitCookieNames.session);
  if (!sessionCookie) return null;

  const payload = decodeJwtPayload(decodeURIComponent(sessionCookie));
  if (!payload || typeof payload.sub !== "string") return null;
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;

  return {
    id: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: typeof payload.name === "string" ? payload.name : typeof payload.preferred_username === "string" ? payload.preferred_username : undefined
  };
}

function firmNameFor(user: SessionUser) {
  if (user.email?.includes("@")) {
    const domain = user.email.split("@")[1]?.split(".")[0];
    if (domain) return `${domain.charAt(0).toUpperCase()}${domain.slice(1)} Firm`;
  }
  return user.name ? `${user.name} Firm` : "My Firm";
}

export async function requireFirmSession(request: Request): Promise<FirmSession> {
  const user = getSessionUser(request);
  if (!user) return fail(401, "Sign in to view your clients.");

  const supabase = createSupabaseServerClient();
  if (!supabase) return fail(503, "Supabase is not configured.");

  const membership = await supabase.from("firm_users").select("firm_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (membership.error) return fail(500, membership.error.message);
  if (membership.data?.firm_id) return { ok: true, user, firmId: membership.data.firm_id };

  const firm = await supabase.from("firms").insert({ name: firmNameFor(user), email: user.email }).select("id").single();
  if (firm.error) return fail(500, firm.error.message);

  const link = await supabase.from("firm_users").insert({ firm_id: firm.data.id, user_id: user.id, role: "owner" });
  if (link.error) return fail(500, link.error.message);

  return { ok: true, user, firmId: firm.data.id };
}

export async function requireClientAccess(request: Request, clientId: string): Promise<ClientAccess> {
  if (!isUuid(clientId)) return fail(400, "clientId must be a valid UUID.");

  const session = await requireFirmSession(request);
  if (!session.ok) return session;

  const supabase = createSupabaseServerClient();
  if (!supabase) return fail(503, "Supabase is not configured.");

  const client = await supabase.from("clients").select("id").eq("id", clientId).eq("firm_id", session.firmId).maybeSingle();
  if (client.error) return fail(500, client.error.message);
  if (!client.data) return fail(404, "Client not found in your firm.");

  return { ok: true, user: session.user, firmId: session.firmId, clientId };
}

export async function requireProcessingJobAccess(request: Request, jobId: string): Promise<JobAccess> {
  if (!isUuid(jobId)) return fail(400, "jobId must be a valid UUID.");

  const session = await requireFirmSession(request);
  if (!session.ok) return session;

  const supabase = createSupabaseServerClient();
  if (!supabase) return fail(503, "Supabase is not configured.");

  const job = await supabase.from("processing_jobs").select("id").eq("id", jobId).eq("firm_id", session.firmId).maybeSingle();
  if (job.error) return fail(500, job.error.message);
  if (!job.data) return fail(404, "Processing job not found in your firm.");

  return { ok: true, user: session.user, firmId: session.firmId, jobId };
}

export async function requireFirmRowAccess(request: Request, table: string, id: string): Promise<RowAccess> {
  if (!isUuid(id)) return fail(400, "id must be a valid UUID.");

  const session = await requireFirmSession(request);
  if (!session.ok) return session;

  const supabase = createSupabaseServerClient();
  if (!supabase) return fail(503, "Supabase is not configured.");

  const row = await supabase.from(table).select("id").eq("id", id).eq("firm_id", session.firmId).maybeSingle();
  if (row.error) return fail(500, row.error.message);
  if (!row.data) return fail(404, "Record not found in your firm.");

  return { ok: true, user: session.user, firmId: session.firmId, id };
}
