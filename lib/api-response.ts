import { NextResponse } from "next/server";

export function serviceResponse<T extends { ok: boolean }>(result: T) {
  if (result.ok) {
    return NextResponse.json(result);
  }

  const failure = result as T & { status?: number };
  return NextResponse.json(result, { status: failure.status ?? 500 });
}
