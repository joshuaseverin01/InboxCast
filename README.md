# InboxCast

InboxCast is a private personal MVP that turns Google Gmail metadata and Calendar events into written and audio morning briefings.

## What Works

- Google OAuth with Gmail metadata, optional selected-message read-only, Gmail compose, and Calendar events read-only scopes
- Server-side Gmail metadata and Calendar event fetching
- Written AI briefing generation
- OpenAI text-to-speech audio generation
- AI Concierge over the latest generated briefing
- Optional user-approved full-content reading for selected Gmail messages in Concierge
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
- Full email bodies are read only after the user explicitly selects specific messages in Concierge.
- Gmail draft creation only creates a draft for user review. InboxCast never sends email.
- The app does not store full email bodies or Google OAuth tokens in `localStorage`.
- PDF exports are generated in the browser and are not uploaded or stored permanently.
- OpenAI usage counters in Settings are approximate browser-local counts, not billing records.

See `SECURITY_NOTES.md` for the current data flow and pre-public-launch risks.
