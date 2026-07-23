export function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function titleCase(value: string) {
  return normalizeWhitespace(value)
    .toLocaleLowerCase("fr-FR")
    .replace(/(^|[\s'-])\p{L}/gu, (letter) =>
      letter.toLocaleUpperCase("fr-FR"),
    );
}

export function comparisonKey(value: string) {
  return normalizeWhitespace(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function normalizeEmail(value: string) {
  const normalized = normalizeWhitespace(value).toLowerCase();
  return normalized || null;
}

export function normalizePhone(value: string) {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) {
    return null;
  }

  const startsWithPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
    return digits ? `+${digits}` : null;
  }
  return digits ? `${startsWithPlus ? "+" : ""}${digits}` : null;
}

export function normalizeExternalUrl(value: string) {
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return withProtocol;
  }
}

export function normalizeLinkedinUrl(value: string) {
  const normalized = normalizeExternalUrl(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return normalized;
  }
}

export function normalizeDepartment(value: string) {
  const normalized = normalizeWhitespace(value).toUpperCase();
  return /^\d$/.test(normalized) ? normalized.padStart(2, "0") : normalized;
}

export function normalizeDate(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  const frenchDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized);
  const isoValue = frenchDate
    ? `${frenchDate[3]}-${frenchDate[2]}-${frenchDate[1]}`
    : normalized;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoValue);
  if (!match) {
    return isoValue;
  }

  const date = new Date(`${isoValue}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== isoValue
    ? isoValue
    : isoValue;
}

export function normalizeEnum(value: string, fallback: string) {
  const normalized = normalizeWhitespace(value)
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  return normalized || fallback;
}

export function normalizePotentialNeeds(value: string) {
  return value.split("|").map(normalizeWhitespace).filter(Boolean).slice(0, 12);
}

export function normalizedDomain(value: string | null) {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function neutralizeCsvFormula(value: string) {
  return /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
}
