import { NextResponse } from "next/server";
import { serviceResponse } from "@/lib/api-response";
import { ClientSchema, deleteRow, getRow, updateRow } from "@/lib/mvp";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return serviceResponse(await getRow("clients", id));
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null);
  const parsed = ClientSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid client payload.", issues: parsed.error.issues }, { status: 400 });
  }

  const { id } = await context.params;
  return serviceResponse(
    await updateRow("clients", id, {
      firm_id: parsed.data.firmId,
      organization_id: parsed.data.organizationId,
      name: parsed.data.name,
      business_type: parsed.data.businessType,
      gst_number: parsed.data.gstNumber,
      contact_name: parsed.data.contactName,
      contact_email: parsed.data.contactEmail
    })
  );
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return serviceResponse(await deleteRow("clients", id));
}
