import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/integrations/supabase/server";
import { safeRedirectPath } from "@/lib/security/redirects";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeRedirectPath(
    request.nextUrl.searchParams.get("next"),
    "/onboarding",
  );

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  const errorUrl = new URL("/login", request.url);
  errorUrl.searchParams.set(
    "error",
    "Le lien est invalide ou a expiré. Demandez-en un nouveau.",
  );
  return NextResponse.redirect(errorUrl);
}
