# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please do not open a public GitHub issue.

Instead, report it privately by emailing **erik@ankrom.ai** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact

You can expect a response within 48 hours. If the issue is confirmed, a fix will be prioritized and released as soon as possible.

## Scope

This project is a read-only Cloudflare Worker that scrapes public data from Heartland Soccer's website. It has no user accounts, no persistent storage, and no write access to any external systems.

Relevant areas for security review:

- XSS via unescaped user-supplied team IDs in rendered HTML
- Open redirect or URL injection via team ID parameter
- Cache poisoning via manipulated request headers
- Exposure of the `CF_ANALYTICS_TOKEN` Worker secret
