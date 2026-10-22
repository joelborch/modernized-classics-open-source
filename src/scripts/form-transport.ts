/**
 * The house form transport, as the sibling Astro sites use it: POST the
 * WorkerFlow endpoint, retry an outage, and never report a send that did not
 * happen.
 *
 *   1. Success is a 2xx whose JSON says `sent === true`. An HTML error page or
 *      a 200 without that flag is an outage, not a success.
 *   2. Outage-shaped failures (network error, 5xx, 404, non-JSON, 2xx without
 *      `sent`) retry twice, after about 1s and 3s.
 *   3. A structured 4xx on the FIRST attempt is a user-fixable validation
 *      problem, so it neither retries nor reports an outage. Later attempts
 *      reuse a spent Turnstile token, so their 4xx says nothing about the
 *      visitor's input.
 *
 * There is no spillway here (see src/lib/form-config.ts): an outage ends in the
 * outage message, which points the reader at the repository.
 *
 * The module touches no browser globals at module scope, so the test suite can
 * exercise it with an injected fetch and clock.
 */
export const PRIMARY_RETRY_DELAYS_MS = [1000, 3000];
export const TURNSTILE_FIELD = "cf-turnstile-response";

export const OUTAGE_MESSAGE =
  "That did not send. Check your connection and try once more, or write to us from the repository page.";
export const DEFAULT_ERROR_MESSAGE = "That did not send. Please try again.";

export type Payload = Record<string, unknown>;

export type TransportDeps = {
  fetch?: typeof fetch | null;
  sleep?: (ms: number) => Promise<void>;
};

type ResolvedDeps = {
  fetch: typeof fetch | null;
  sleep: (ms: number) => Promise<void>;
};

export type PrimaryResult = {
  status?: number;
  ok?: boolean;
  body?: unknown;
  networkError?: boolean;
};

export type Classification =
  | { kind: "success" }
  | { kind: "user-error"; message: string }
  | { kind: "outage" };

export type SubmitResult =
  | { outcome: "success" }
  | { outcome: "error"; message: string }
  | { outcome: "outage"; message: string };

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function resolveDeps(deps?: TransportDeps): ResolvedDeps {
  const provided = deps ?? {};
  return {
    fetch:
      provided.fetch === undefined
        ? typeof fetch === "function"
          ? fetch.bind(globalThis)
          : null
        : provided.fetch,
    sleep: provided.sleep ?? defaultSleep,
  };
}

/** Decide what a single attempt means. */
export function classifyPrimaryResult(result: PrimaryResult | null): Classification {
  if (!result || result.networkError) {
    return { kind: "outage" };
  }

  const status = Number(result.status) || 0;
  const body = result.body;
  const parsed = Boolean(body) && typeof body === "object";
  const record = parsed ? (body as Record<string, unknown>) : null;

  if (status >= 200 && status < 300) {
    if (record && record.sent === true) {
      return { kind: "success" };
    }
    // A 2xx that is not the documented success envelope (an HTML error page,
    // an interstitial, a truncated body) means nothing was delivered.
    return { kind: "outage" };
  }

  // 404 is a route or deploy outage, not something the visitor can correct.
  if (status >= 400 && status < 500 && status !== 404 && record) {
    const hasStructuredError =
      typeof record.error === "string" || typeof record.message === "string";
    if (hasStructuredError) {
      return {
        kind: "user-error",
        message: typeof record.message === "string" && record.message
          ? record.message
          : DEFAULT_ERROR_MESSAGE,
      };
    }
  }

  return { kind: "outage" };
}

async function postPrimary(
  endpoint: string,
  payload: Payload,
  deps: ResolvedDeps
): Promise<PrimaryResult> {
  if (!deps.fetch) {
    return { networkError: true };
  }

  let response: Response;
  try {
    response = await deps.fetch(endpoint, {
      method: "POST",
      headers: { Accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return { networkError: true };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { status: response.status, ok: response.ok, body };
}

/** Submit one payload, retrying an outage before giving up. */
export async function submitForm(options: {
  endpoint: string;
  payload: Payload;
  deps?: TransportDeps;
}): Promise<SubmitResult> {
  const deps = resolveDeps(options.deps);
  const attempts = PRIMARY_RETRY_DELAYS_MS.length + 1;
  let sawOutage = false;

  if (!options.endpoint || !deps.fetch) {
    return { outcome: "outage", message: OUTAGE_MESSAGE };
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      await deps.sleep(PRIMARY_RETRY_DELAYS_MS[attempt - 1]);
    }

    const classification = classifyPrimaryResult(
      await postPrimary(options.endpoint, options.payload, deps)
    );

    if (classification.kind === "success") {
      return { outcome: "success" };
    }

    if (classification.kind === "user-error") {
      if (attempt === 0 && !sawOutage) {
        return { outcome: "error", message: classification.message };
      }
      break;
    }

    sawOutage = true;
  }

  return { outcome: "outage", message: OUTAGE_MESSAGE };
}
