# Security and sensitive material

Never put credentials, source archives, or private model transcripts in a public
issue or PR. Report suspected credential exposure, vulnerabilities, or access
problems through [GitHub private vulnerability reporting](https://github.com/joelborch/modernized-classics-open-source/security/advisories/new).
Include the affected file or commit and service name, but never the credential value.

The pipeline runs local executables under your account. Configure only trusted
CLIs/wrappers. A temporary working directory prevents repository context pickup;
it does not isolate the process from your computer. See `docs/providers.md` for
provider-specific tool restrictions and their limits.

Source provenance concerns should identify the work, edition, and suspect portion
without uploading another copy of the book. Maintainers record the evidence and
decide whether replacement, removal or further review is needed.
