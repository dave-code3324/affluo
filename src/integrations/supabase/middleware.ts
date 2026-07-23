import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";

  const redirectResponse = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { publishableKey, url } = getSupabasePublicEnv();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, options, value }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const isOnboarding = request.nextUrl.pathname.startsWith("/onboarding");

  if (!userId && (isDashboard || isOnboarding)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (userId && (isDashboard || isOnboarding)) {
    const { data: membership } = await supabase
      .from("firm_members")
      .select("firm_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (isDashboard && !membership) {
      return redirectWithCookies(request, response, "/onboarding");
    }

    if (isOnboarding && membership) {
      return redirectWithCookies(request, response, "/dashboard");
    }
  }

  return response;
}
