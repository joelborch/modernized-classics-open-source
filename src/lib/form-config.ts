/**
 * Public form configuration. These values ship in the page's JavaScript, the
 * same way they do on the other Astro sites: the WorkerFlow endpoint and the
 * Turnstile sitekey are public by design, and every write is gated server-side
 * by the Turnstile secret, which lives only in the Worker.
 *
 * Unlike the client sites, this form has no Apps Script spillway. Reader mail
 * is not a lead worth capturing in a shared spreadsheet, and the fallback URL
 * and token would be committed to a public repository.
 */
const DEFAULT_WORKERFLOW_API_BASE = "https://apicloudflarewndml.dentistrybrandsllc.com";
const DEFAULT_TURNSTILE_SITE_KEY = "0x4AAAAAABRmRR5dqJGZRe6K";

/** The handler accepts exactly this form id and this Turnstile action. */
export const CONTACT_FORM_ID = "classics_contact";
/** The WorkerFlow route behind /api/<routePath>. */
const ROUTE_PATH = "classics_forms";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/g, "");
}

export function getFormConfig() {
  const explicitEndpoint = (import.meta.env.PUBLIC_CLASSICS_FORMS_ENDPOINT ?? "").trim();
  const apiBase = trimTrailingSlash(
    (import.meta.env.PUBLIC_WORKERFLOW_API_BASE ?? DEFAULT_WORKERFLOW_API_BASE).trim()
  );
  const turnstileSiteKey =
    (import.meta.env.PUBLIC_TURNSTILE_SITE_KEY ?? "").trim() || DEFAULT_TURNSTILE_SITE_KEY;

  return {
    formId: CONTACT_FORM_ID,
    turnstileAction: CONTACT_FORM_ID,
    turnstileSiteKey,
    submissionEndpoint:
      explicitEndpoint || `${apiBase || DEFAULT_WORKERFLOW_API_BASE}/api/${ROUTE_PATH}`,
  };
}
