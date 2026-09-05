# Model providers

The site and deterministic tests need no model account. Modernization calls your
locally installed CLI; its account, subscription terms, limits and charges apply.
The repository does not distribute credentials or provide model access.

Set environment variables in your shell. `.env.example` is documentation only;
the pipeline does not automatically load `.env` files.

```sh
MODERNIZE_PROVIDER=claude MODERNIZE_MODEL=opus npm run modernize -- --help
MODERNIZE_PROVIDER=codex MODERNIZE_MODEL=YOUR_MODEL npm run modernize -- input.epub --slug example --to select
MODERNIZE_PROVIDER=agy MODERNIZE_MODEL=gemini-3.7-flash-low npm run modernize -- input.epub --slug example --to select
```

Claude defaults to `opus`; use an explicit model identifier when repeatability
matters. Codex, AGY and custom commands require `MODERNIZE_MODEL`. Aliases can
change upstream even when the saved configuration fingerprint stays the same.
Record the CLI version and resolved model in your contribution notes when known.

`MODERNIZE_CLI` overrides the executable (absolute paths are supported). Authenticate
the CLI yourself before running the pipeline. The adapter invokes an argument
array directly, never a shell command string. Calls use a unique temporary working
directory that is removed after the child exits. This prevents repository-local
instruction files being picked up; it is not an operating-system security boundary.

| Provider | Protocol | Constraints |
|---|---|---|
| Claude | `claude -p --output-format json`; native JSON schema | Built-in tools disabled; explicit empty MCP configuration; user/project setting sources and slash commands disabled. Local authentication still applies. |
| Codex | `codex exec --json`; native output schema | Read-only sandbox, no approvals, shell feature disabled, user configuration ignored, ephemeral session. These flags require a compatible CLI; read-only mode is not a guarantee that all tools or network access are unavailable. |
| Gemini via AGY | Native `event` stream JSON on stdin/stdout; native JSON schema | Uses `agy` with terminal sandbox and slash commands disabled. Configured tools/MCP may remain available, and sessions may persist outside the temporary directory. No permission bypass is used. Run only with a trusted local CLI configuration. |
| Custom | Versioned JSON request/response over stdin/stdout | You control the executable and its permissions. The runner does not sandbox arbitrary commands. Use trusted wrappers and configure their tool, network and filesystem access yourself. |

Effort is passed to Claude, Codex and AGY; unsupported model/effort combinations
fail rather than silently changing models. AGY accepts low, medium and high;
xhigh and max are rejected before invocation. `MODERNIZE_PROVIDER=gemini` is an
alias for `agy`, and invokes the AGY executable. Override stage hints with `MODERNIZE_EFFORT_SELECT`,
`MODERNIZE_EFFORT_REWRITE`, `MODERNIZE_EFFORT_QA`, `MODERNIZE_EFFORT_REVISE`, and
`MODERNIZE_EFFORT_FRONTMATTER` (`low`, `medium`, `high`, `xhigh`, or `max`).

`MODERNIZE_CHUNK_CHARS` bounds chunk size; reduce it for smaller context windows.
`--concurrency N` controls parallel calls. `MODERNIZE_TIMEOUT_MS` defaults to 300000.
Combined stdout/stderr is limited to 8 MB per call. On Unix, timeout or cancellation
terminates the process group, escalating after one second. On Windows, only the
direct child is terminated; wrappers must manage their descendants.

Malformed output, refusal, timeout and authentication failures stop that call.
There are no automatic transport retries, avoiding duplicate charges after an
uncertain outcome; rerun the pipeline to retry unfinished work. QA permits at
most two revision rounds per chunk and never publishes unresolved failures.
Costs and token fields unavailable from the CLI remain `null`/“unknown”. AGY
reads input, output and cache-read tokens from its final result; dollar cost
remains unknown. Its thinking-token metric is not included in output tokens.
Usage from received but rejected model responses is retained. Transport failures
can occur without a usable receipt, so reported totals are not a billing ledger.
Provider diagnostics are not copied into exceptions because they can include
prompts or credentials. Diagnose login/configuration in the CLI directly.

## Resume provenance

`state.json` binds the workspace to the source EPUB SHA-256 and records the
provider, requested model, executable/arguments, generation
settings, prompt hashes and adapter version. A changed fingerprint requires
`--from select` (which invalidates downstream output) or a separate workspace.
Old workspaces without provenance need a restart or explicit `--adopt-run-config`;
adoption records that prior output has unknown provenance. It does not certify
which model produced that output. `--status` does not adopt or alter configuration.

## Custom command protocol

```sh
export MODERNIZE_PROVIDER=custom
export MODERNIZE_MODEL=my-model
export MODERNIZE_CLI=/absolute/path/to/node
export MODERNIZE_CLI_ARGS='["/absolute/path/to/my-wrapper.mjs"]'
npm run modernize -- input.epub --slug example --to select
```

The wrapper receives exactly one JSON request on stdin, terminated by a newline:

```json
{"protocol":1,"model":"my-model","system":"instructions","prompt":"source text","effort":"high","schema":null}
```

`schema` contains JSON Schema for selection, QA and frontmatter calls. Return a
single JSON response and exit zero. Put diagnostics on stderr. For plain text:

```json
{"protocol":1,"text":"Rewritten passage","usage":{"input":null,"output":null,"cacheRead":null,"usd":null}}
```

For structured output, return `data` containing the object, or `text` containing
JSON. The pipeline validates it against the same Zod schema for every provider.
Do not put explanatory prose around JSON. Missing metrics are treated as unknown.
Return `{"protocol":1,"refusal":true}` for a refusal, or exit nonzero on failure.
Credentials stay in the wrapper's local authentication mechanism, never its
committed arguments or source. Do not commit custom wrappers containing secrets.

## Verification

`npm test` uses fake subprocesses for provider contracts, output validation,
timeouts, cancellation and usage; it makes no model calls. To explicitly spend
a small amount of your model account on text and schema smoke tests:

```sh
MODERNIZE_PROVIDER=claude MODERNIZE_MODEL=opus npm run smoke:model -- --live
```

Repeat with each installed provider/model you intend to use. Passing the smoke
test establishes transport compatibility, not rewrite quality or copyright status.
Review a short source passage and QA result before committing to a whole book.

Reference: [Codex noninteractive mode](https://developers.openai.com/codex/noninteractive/).
AGY integration was checked against locally installed `agy --help`, `agy models`,
and live text/schema probes. Check these commands when upgrading AGY.
The adapter does not delete AGY account-level conversation history.
