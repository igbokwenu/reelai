# Security Policy

## Reporting Vulnerabilities

Please report suspected vulnerabilities or secret leaks privately to the maintainers. Do not open a public issue containing secrets, exploit details, private uploaded content, or provider URLs with credentials.

Include:

- A concise description of the issue.
- Steps to reproduce, if safe to share.
- Affected files, routes, or configuration.
- Any logs with secrets redacted.

## Secrets

Never commit `.env`, QwenCloud API keys, OSS credentials, database credentials, generated private artifacts, or user-uploaded brand material. `.env.example` must contain placeholders only.
