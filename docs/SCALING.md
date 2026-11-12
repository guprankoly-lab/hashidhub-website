# Deployment Guide

## Production deployment

1. Push the repository to the target Vercel project.
2. Ensure the Firebase config matches the live project.
3. Set required environment variables for Vercel:
   - `FIREBASE_SERVICE_ACCOUNT`
   - `CRON_SECRET`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
4. Configure Cloudflare Worker media domain if using custom media host.
5. Deploy `firestore.rules` to Firebase.
6. Activate Firebase Authentication providers and Authorized domains.
7. Validate PWA and SW updates after deployment.

## Recommended order
- Firebase project setup
- Firestore rules
- Media worker setup
- Vercel deploy
- Service worker cache flush
- Production smoke test

## Production checks
- Sign up/login flow
- Post creation
- Reels playback
- Search page
- Marketplace listing creation
- Job application submission
- AI Assistant generation
- Verification workflow
- Push permission flow

## Rollback plan
- Keep previous build artifact available in Vercel.
- Revert only the frontend shell or rules if required.
- Flush service worker cache after rollback to avoid stale shell issues.

