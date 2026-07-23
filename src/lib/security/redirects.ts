const DEFAULT_REDIRECT = "/dashboard";

export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback = DEFAULT_REDIRECT,
) {
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  ) {
    return fallback;
  }

  return candidate;
}
