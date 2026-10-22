# The contact form

The colophon's "Write to us" form posts to the same house endpoint the other
Astro sites use, rather than a third-party form service:

- Endpoint: `https://apicloudflarewndml.dentistrybrandsllc.com/api/classics_forms`
- Handler: `workerflow-private`, `cloudflare/workers/workflow/src/handlers/http/classics_forms.ts`
  (a `forms_engine` route, like the sibling sites' forms)
- Delivery: Google Chat, through `CLASSICS_GCHAT_FORMS_WEBHOOK_URL` with the
  shared `GCHAT_FORMS_WEBHOOK_URL` as a fallback. Reader mail is not a client
  lead, so there is no inbox routing to maintain.

## What the browser sends

`src/scripts/form-transport.ts` POSTs JSON: `formId` (`classics_contact`),
`name`, `email`, `message`, the `classics_contact_website` honeypot,
`cf-turnstile-response`, `fill_ms`, `sourceUrl` and `submittedAt`.

A send counts as delivered only when the response is a 2xx whose JSON says
`sent: true`. An HTML error page, an interstitial, a 404 or a 5xx is an outage,
so the POST is retried after about 1s and 3s; when all three attempts fail the
reader sees the outage message and is pointed at the repository. A structured
4xx on the first attempt is a validation problem the reader can fix, so it is
shown as-is and not retried — later attempts would reuse a spent Turnstile
token, and their 4xx says nothing about the input.

Unlike the client sites, this form has no Apps Script spillway. Its fallback URL
and token are shared public values, and this repository is public; reader mail
is not worth capturing in a shared spreadsheet on those terms.

## Configuration

`src/lib/form-config.ts` holds the public defaults, each overridable with a
`PUBLIC_*` build variable (Workers Builds variables, then a redeploy):

| Variable | Overrides |
| --- | --- |
| `PUBLIC_CLASSICS_FORMS_ENDPOINT` | the whole endpoint URL |
| `PUBLIC_WORKERFLOW_API_BASE` | the API host the endpoint is built from |
| `PUBLIC_TURNSTILE_SITE_KEY` | the Turnstile sitekey |

The endpoint and sitekey are public by design: every write is gated server-side
by the Turnstile secret, which exists only in the Worker. The handler also
requires the Turnstile action `classics_contact` and an attested hostname that
matches the submitting page, so the sitekey's hostname list must cover
`modernizedclassicsbooks.com`, `www.modernizedclassicsbooks.com` and the
`modernized-classics-open-source.joel-a67.workers.dev` preview host. A sitekey
whose hostnames exclude the live site stops the form.

## Testing

`src/scripts/form-transport.test.ts` covers the success envelope, the retries,
the validation path and the outage path with an injected fetch and clock; it
makes no network calls. The handler's own fixtures live in `workerflow-private`
(`npm run test:classics-forms`, plus `test:route-fixtures` and `test:alerts`).
