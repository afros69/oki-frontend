import { NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {

  const supabaseResponse = NextResponse.next({
    request,
  });

  return supabaseResponse;
}
