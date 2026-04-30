# InboxCast

InboxCast is a private personal MVP that turns Google Gmail metadata and Calendar events into written and audio morning briefings.

## What Works

- Google OAuth with Gmail metadata and Calendar events read-only scopes
- Server-side Gmail metadata and Calendar event fetching
- Written AI briefing generation
- OpenAI text-to-speech audio generation
- AI Concierge over the latest generated briefing
- Local browser Outputs for saved Concierge responses, including browser-side PDF export

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
- The app does not request Gmail send, modify, or full-read scopes.
- The app does not fetch full email bodies or store Google OAuth tokens in `localStorage`.
- PDF exports are generated in the browser and are not uploaded or stored permanently.
- OpenAI usage counters in Settings are approximate browser-local counts, not billing records.

See `SECURITY_NOTES.md` for the current data flow and pre-public-launch risks.
