# Scaling Guide

## 1. Firestore scaling principles
- Separate collections by domain rather than overloading `posts`.
- Add indexes for search and feed ranking.
- Paginate by timestamp and cursor-based sorting.
- Use subcollections for nested data where access is per-user.
- Keep large media metadata small and indexed.

## 2. Query plan
Recommended query patterns:
- Feed: `userFeed/{uid}` with pagination
- Reels: `reels` ordered by `createdAt` and engagement
- Search: dedicated `searchIndex` or composite indexes
- Jobs: filter by category, location, and status
- Marketplace: filter by category, price, and region

## 3. Media scaling
- Use Cloudflare or a dedicated media CDN.
- Move large media assets outside the main UI origin.
- Use signed URLs for private media.
- Add image resizing and thumbnail generation.

## 4. App scaling
- Split UI into modular HTML pages and data modules.
- Introduce a server-side API layer before global launch.
- Move sensitive actions away from pure client calls.
- Instrument analytics and event logs for content and monetization funnels.

## 5. Performance budgets
- Keep initial critical JS under controlled size.
- Lazy-load non-critical features.
- Use virtualized rendering for large lists.
- Cache user and feed metadata aggressively.

