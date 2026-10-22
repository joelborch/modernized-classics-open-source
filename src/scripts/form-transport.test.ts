import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ERROR_MESSAGE,
  OUTAGE_MESSAGE,
  PRIMARY_RETRY_DELAYS_MS,
  classifyPrimaryResult,
  submitForm,
} from './form-transport';

type Reply = { status: number; body?: unknown; networkError?: boolean };

function stubFetch(replies: Reply[]) {
  const calls: Array<{ url: string; payload: Record<string, unknown> }> = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const reply = replies[Math.min(calls.length, replies.length - 1)];
    calls.push({
      url: String(input),
      payload: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });
    if (reply.networkError) {
      throw new Error('network down');
    }
    return new Response(typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body ?? {}), {
      status: reply.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

function submit(replies: Reply[]) {
  const { fetchImpl, calls } = stubFetch(replies);
  const slept: number[] = [];
  const result = submitForm({
    endpoint: 'https://api.example/api/classics_forms',
    payload: { formId: 'classics_contact', message: 'Hello' },
    deps: {
      fetch: fetchImpl,
      sleep: async (ms) => {
        slept.push(ms);
      },
    },
  });
  return { result, calls, slept };
}

describe('classifyPrimaryResult', () => {
  it('treats only a 2xx with sent true as a success', () => {
    expect(classifyPrimaryResult({ status: 200, body: { sent: true } })).toEqual({ kind: 'success' });
    expect(classifyPrimaryResult({ status: 200, body: { ok: true } })).toEqual({ kind: 'outage' });
    expect(classifyPrimaryResult({ status: 200, body: null })).toEqual({ kind: 'outage' });
  });

  it("treats a structured 4xx as the visitor's problem and a 404 as an outage", () => {
    expect(classifyPrimaryResult({ status: 400, body: { error: 'invalid_form_payload', message: 'Fix it' } })).toEqual({
      kind: 'user-error',
      message: 'Fix it',
    });
    expect(classifyPrimaryResult({ status: 400, body: { error: 'invalid_form_payload' } })).toEqual({
      kind: 'user-error',
      message: DEFAULT_ERROR_MESSAGE,
    });
    expect(classifyPrimaryResult({ status: 404, body: { error: 'not_found' } })).toEqual({ kind: 'outage' });
    expect(classifyPrimaryResult({ status: 500, body: { error: 'chat_delivery_failed' } })).toEqual({ kind: 'outage' });
    expect(classifyPrimaryResult({ networkError: true })).toEqual({ kind: 'outage' });
  });
});

describe('submitForm', () => {
  it('reports a success once and does not retry it', async () => {
    const { result, calls, slept } = submit([{ status: 200, body: { sent: true } }]);
    await expect(result).resolves.toEqual({ outcome: 'success' });
    expect(calls).toHaveLength(1);
    expect(slept).toEqual([]);
  });

  it('retries an outage twice and then reports the outage message', async () => {
    const { result, calls, slept } = submit([{ status: 500, body: 'upstream exploded' }]);
    await expect(result).resolves.toEqual({ outcome: 'outage', message: OUTAGE_MESSAGE });
    expect(calls).toHaveLength(3);
    expect(slept).toEqual(PRIMARY_RETRY_DELAYS_MS);
  });

  it('recovers when a retry succeeds', async () => {
    const { result, calls } = submit([
      { status: 502, body: { error: 'chat_delivery_failed' } },
      { status: 200, body: { sent: true } },
    ]);
    await expect(result).resolves.toEqual({ outcome: 'success' });
    expect(calls).toHaveLength(2);
  });

  it('surfaces a validation error from the first attempt without retrying', async () => {
    const { result, calls } = submit([
      { status: 400, body: { error: 'invalid_form_payload', message: 'Please fill in your name, email and message.' } },
    ]);
    await expect(result).resolves.toEqual({
      outcome: 'error',
      message: 'Please fill in your name, email and message.',
    });
    expect(calls).toHaveLength(1);
  });

  it('does not trust a 4xx that follows an outage, because the token is spent', async () => {
    const { result, calls } = submit([
      { status: 503, body: 'gateway' },
      { status: 400, body: { error: 'missing_turnstile_token', message: 'Turnstile token is required' } },
    ]);
    await expect(result).resolves.toEqual({ outcome: 'outage', message: OUTAGE_MESSAGE });
    expect(calls).toHaveLength(2);
  });

  it('reports an outage when there is nothing to post to', async () => {
    await expect(
      submitForm({ endpoint: '', payload: {}, deps: { fetch: null } })
    ).resolves.toEqual({ outcome: 'outage', message: OUTAGE_MESSAGE });
  });
});
