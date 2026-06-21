import { NextResponse } from "next/server";
import { serviceResponse } from "@/lib/api-response";
import { ClientSchema, deleteRow, getRow, updateRow } from "@/lib/mvp";
import { requireClientAccess } from "@/lib/workspace-auth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireClientAccess(request, id);
  if (!access.ok) return serviceResponse(access);

  return serviceResponse(await getRow("clients", id));
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireClientAccess(request, id);
  if (!access.ok) return serviceResponse(access);

  const body = await request.json().catch(() => null);
  const parsed = ClientSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid client payload.", issues: parsed.error.issues }, { status: 400 });
  }

  return serviceResponse(
    await updateRow("clients", id, {
      firm_id: access.firmId,
      organization_id: parsed.data.organizationId,
      name: parsed.data.name,
      business_type: parsed.data.businessType,
      gst_number: parsed.data.gstNumber,
      contact_name: parsed.data.contactName,
      contact_email: parsed.data.contactEmail
    })
  );
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await requireClientAccess(request, id);
  if (!access.ok) return serviceResponse(access);

  return serviceResponse(await deleteRow("clients", id));
}
