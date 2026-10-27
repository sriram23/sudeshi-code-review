# Security Policy

## Reporting a vulnerability

Please do not disclose exploitable vulnerabilities in a public issue.

Report security concerns privately through the contact method listed on the repository maintainer's GitHub profile. If GitHub private vulnerability reporting is enabled for this repository, use that channel. Include steps to reproduce, impact, and relevant evidence.

Do not include real API keys, passwords, access tokens, private source code, or other sensitive credentials in reports.

## Scope and limitations

Sudeshi Code Review is a focused static-analysis tool. It may miss vulnerabilities or report false positives and must not be treated as a guarantee of repository security.

When AI review is enabled, selected source context is sent to Sarvam AI. Do not submit source code you are not authorized to share.

AI-context redaction is best-effort. It attempts to redact recognized values and selected repeated occurrences in supported source patterns. It may not detect dynamically constructed values or every secret-bearing syntax pattern; sensitive content may still be sent to Sarvam AI. Treat redaction as a safeguard, not as a guarantee that code is safe to share.
