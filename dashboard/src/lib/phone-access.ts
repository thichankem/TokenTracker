const KEY_DOMAIN = "tokentracker_phone_access_domain_v1";

/**
 * The default public dashboard URL used when no custom domain is set. Points at
 * the `/dashboard` route (not the landing page) so scanning the QR opens the
 * dashboard directly — or the sign-in page when the phone isn't signed in yet.
 */
export const DEFAULT_PHONE_URL = "https://www.tokentracker.cc/dashboard";

/**
 * Normalize a user-supplied domain/host into a canonical
 * `https://<host>/dashboard` URL, or return "" when the input is not a
 * plausible hostname.
 *
 * Accepts: `token.example.com`, `https://token.example.com`,
 * `http://token.example.com/path`, `TOKEN.EXAMPLE.COM/`. Strips protocol,
 * path, query and fragment; lowercases the host; requires at least one dot so
 * a bare `localhost` or a single label is rejected.
 */
export function normalizePhoneAccessDomain(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  let host = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  host = host.split("/")[0].split("?")[0].split("#")[0].trim();
  host = host.replace(/\.+$/, "");
  if (!host) return "";
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host)) {
    return "";
  }
  return `https://${host.toLowerCase()}/dashboard`;
}

/**
 * The configured custom phone-access domain, or "" when unset. Returns the
 * normalized `https://<host>/` form.
 */
export function getPhoneAccessDomain(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(KEY_DOMAIN) || "").trim();
  } catch {
    return "";
  }
}

/**
 * Persist a custom phone-access domain. Passing an empty/invalid value clears
 * the preference (falls back to DEFAULT_PHONE_URL). Returns the normalized
 * value that was stored ("" when cleared).
 */
export function setPhoneAccessDomain(domain: string): string {
  const normalized = normalizePhoneAccessDomain(domain);
  try {
    if (normalized) window.localStorage.setItem(KEY_DOMAIN, normalized);
    else window.localStorage.removeItem(KEY_DOMAIN);
  } catch {
    /* best-effort; non-persistent fallback to default */
  }
  return normalized;
}

/**
 * The URL the phone QR should encode: the custom domain when set, otherwise
 * the default public dashboard.
 */
export function getPhoneAccessUrl(): string {
  return getPhoneAccessDomain() || DEFAULT_PHONE_URL;
}