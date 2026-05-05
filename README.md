# InboxCast

InboxCast is a private personal MVP that turns Google Gmail metadata and Calendar events into written and audio morning briefings.

## What Works

- Google OAuth with Gmail metadata, optional selected-message read-only, Gmail compose, and Calendar events read-only scopes
- Server-side Gmail metadata and Calendar event fetching
- Written AI briefing generation
- OpenAI text-to-speech audio generation
- AI Concierge over the latest generated briefing
- Optional user-approved full-content reading for selected Gmail messages and threads in Concierge
- Local browser Outputs for saved Concierge responses, including browser-side PDF export
- User-approved Gmail draft creation from saved Outputs

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and fill in:

```bash
AUTH_SECRET=
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
OPENAI_API_KEY=
OPENAI_BRIEFING_MODEL=gpt-4o-mini
OPENAI_CONCIERGE_MODEL=gpt-4o-mini
OPENAI_TTS_MODEL=gpt-4o-mini-tts
NEXT_PUBLIC_FEEDBACK_EMAIL=
```

3. Run locally:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Production Notes

- Set the same environment variables in Vercel.
- Use the deployed URL as `AUTH_URL`.
- Configure the Google OAuth redirect URI for `/api/auth/callback/google`.
- Add these Google OAuth consent screen scopes: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/gmail.metadata`, `https://www.googleapis.com/auth/gmail.readonly`, `https://www.googleapis.com/auth/gmail.compose`, and `https://www.googleapis.com/auth/calendar.events.readonly`.
- After adding `gmail.readonly` or `gmail.compose`, reconnect Google so the session has the new permission.
- The app does not request Gmail send, modify, or `mail.google.com` scopes.
- Full email bodies or threads are read only after the user explicitly selects specific messages or one selected thread in Concierge.
- Gmail draft creation only creates a draft for user review. InboxCast never sends email.
- The app does not store full email bodies or Google OAuth tokens in `localStorage`.
- PDF exports are generated in the browser and are not uploaded or stored permanently.
- OpenAI usage counters in Settings are approximate browser-local counts, not billing records.

## Public Demo

- `/demo` is a public interactive demo route for portfolio, advisor, investor, or tester walkthroughs.
- The demo uses fictional inbox and calendar data only.
- Demo mode does not require login, connect Google, call Google APIs, call OpenAI routes, or create real Gmail drafts.
- Demo saved outputs use the separate localStorage key `inboxcast_demo_outputs`.
- The real authenticated app flow remains under the normal Dashboard, Briefing, Concierge, Outputs, and Settings routes.
- Deleting `/demo` from the URL does not grant access to the full app.

## Route Protection

- `/` and `/demo` are public.
- Real app routes such as `/dashboard`, `/briefing`, `/concierge`, `/outputs`, and `/settings` require Google sign-in.
- Set `BETA_ALLOWED_EMAILS` in `.env.local` or Vercel to restrict private beta access to specific comma-separated emails.
- If `BETA_ALLOWED_EMAILS` is empty or missing, any authenticated Google user can access the real app as before.
- If an authenticated user's email is not in `BETA_ALLOWED_EMAILS`, they see a private beta access message with a link back to `/demo`.

## Private Beta/Testing

- InboxCast is a private beta MVP for trusted testers, not a public production SaaS app.
- Google OAuth test users may need to be added in Google Cloud before testers can connect.
- Required scopes are `openid`, `email`, `profile`, `gmail.metadata`, `gmail.readonly`, `gmail.compose`, and `calendar.events.readonly`.
- Testers should reconnect Google after any scope changes.
- Browser-local soft limits are used to reduce accidental API credit spikes: 10 briefings/day, 10 TTS generations/day, and 50 Concierge AI calls/day.
- Feedback is stored locally in the tester browser and can optionally open a mailto link if `NEXT_PUBLIC_FEEDBACK_EMAIL` is configured.
- Known limitations: no database-backed accounts, no formal compliance audit, no public privacy/legal launch package, and AI outputs must be reviewed before acting.

See `SECURITY_NOTES.md` for the current data flow and pre-public-launch risks.
