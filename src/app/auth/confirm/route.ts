import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/integrations/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  const errorUrl = new URL("/login", request.url);
  errorUrl.searchParams.set(
    "error",
    "La confirmation a échoué. Vérifiez le lien reçu par email.",
  );
  return NextResponse.redirect(errorUrl);
}
