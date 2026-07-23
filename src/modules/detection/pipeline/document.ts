import { createHash } from "node:crypto";

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalValue(nested)]),
    );
  }
  return value;
}

export function normalizeDocumentContent(content: string) {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  try {
    return JSON.stringify(canonicalValue(JSON.parse(normalized)));
  } catch {
    return normalized.replace(/[ \t]+/g, " ");
  }
}

export function documentFingerprint(content: string) {
  return createHash("sha256")
    .update(normalizeDocumentContent(content))
    .digest("hex");
}

export function normalizeSourceUrl(value: string) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Le protocole de la source n’est pas autorisé.");
  }
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  [...url.searchParams.keys()]
    .filter((key) => key.toLowerCase().startsWith("utm_"))
    .forEach((key) => url.searchParams.delete(key));
  return url.toString().replace(/\/$/, "");
}
