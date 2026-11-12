# Security Guide

## Core controls
- Require Firebase authentication for private actions.
- Restrict writes by owner or admin checks.
- Validate file uploads and media types.
- Keep service account secrets in environment variables only.
- Require HTTPS for all production routes.

## Recommended protections
- Add rate limiting and abuse detection for post creation and comments.
- Add moderation and reporting workflow for unwanted content.
- Enforce creator verification before payout or premium monetization.
- Use signed URLs for media delivery when private.
- Set strict CSP and security headers at the edge.

## Risk areas
- Client-side API keys
- Untrusted user-generated content
- Media uploads without scanning
- Spam and fake verification requests
- Monetization fraud and payout abuse

## Response plan
1. Freeze malicious account actions.
2. Review Firestore records and moderation logs.
3. Remove or quarantine abusive content.
4. Notify affected users through the platform notification system.
5. Add remediation to rules and moderation heuristics.

