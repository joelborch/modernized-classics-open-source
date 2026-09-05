# Maintainer guide

The public collaboration repository is
<https://github.com/joelborch/modernized-classics-open-source>. It is separate
from the private production repository and has no deployment or Cloudflare
connection. Do not copy production credentials or deployment configuration into it.

## Repository and history

Verify private backups before removing historical files. Inventory branches,
tags, PR references, releases, LFS and generated artifacts. Rewriting current main
does not remove historical binaries reachable through another branch or PR.
Inspect copyright/source evidence separately from credential and file-policy scans.

When rewriting or moving history, verify every published ref and blob, then use a
fresh clone to test contributor setup. GitHub can retain old PR references and
cached objects after a history rewrite, so publish sanitized history to a new
repository instead of assuming a force push removed the old objects.

## GitHub configuration

Protect `main` by requiring the `test` CI check, one approving review and CODEOWNER
review from `@joelborch`. Dismiss stale approvals and block force pushes and branch
deletion. Collaborators may write branches but must use pull requests for `main`.
The owner retains administrator bypass and may push directly to `main`, including
when an owner-authored change has no eligible second reviewer. Verify these rules
through GitHub readback after changing them.

Keep CI's token read-only and checkout credentials unpersisted. Never execute
untrusted PR code in a privileged `pull_request_target` job. Require approval for
outside-contributor workflow runs where supported. Keep paid model smoke checks
out of CI. A fork contribution should need no production secrets.

Do not add production or Cloudflare secrets. If a secret is ever removed from this
repository, remember that deleting the GitHub value and revoking the underlying
provider credential are separate actions.

## Local release evidence

Run `npm ci` and `npm run verify` from a fresh clone. Check every book's source
record, cover provenance and license metadata, and report unresolved claims for
owner review. Verify all generated downloads and source purity. Keep provider
contract test results separate from live CLI compatibility and editorial QA.

## Production separation

The existing private production repository remains the deployment source. Public
repository pushes do not authorize or perform a deployment, a Cloudflare change,
or a change to the private repository. Handle any future production release as a
separate operation with an identified commit and known-good rollback. Keep
credentials and production resource access out of contributor builds.
