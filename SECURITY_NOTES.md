# InboxCast Security Notes

## Current Data Flow

1. The user signs in with Google through Auth.js using Google OAuth.
2. Server routes read Google access and refresh tokens from the Auth.js JWT and refresh them server-side when needed.
3. `/api/google/briefing-context` fetches Gmail metadata and Google Calendar event data for the selected time range.
4. `/api/briefing/generate` sends compact metadata/snippets and calendar snippets to OpenAI to create a written briefing.
5. `/api/briefing/tts` sends only the generated transcript to OpenAI text-to-speech and streams audio back to the browser.
6. `/api/concierge/chat` sends recent chat messages, the generated briefing, and bounded metadata snippets when available to OpenAI.
7. `/api/google/drafts/create` creates a Gmail draft only after the user confirms recipient, subject, and body from a saved Output.

## What Is Stored

- Auth.js stores Google OAuth token data in the server-readable JWT/session cookie.
- Browser `localStorage` stores generated briefing output and saved Concierge outputs for this personal prototype.
- Browser `localStorage` stores audio playback preferences such as speed.
- Environment variables store Google OAuth credentials, `AUTH_SECRET`, and `OPENAI_API_KEY`.
- Draft recipient, subject, and body values are kept only in temporary component state until the user creates the draft.

## What Is Not Stored

- OAuth access tokens and refresh tokens are not exposed to client components or stored in `localStorage`.
- Full Gmail email bodies and attachments are not fetched.
- Existing emails are not sent, modified, deleted, or marked read.
- Gmail drafts are not stored in InboxCast; only Gmail receives the user-approved draft content.
- Calendar events are not created, edited, or deleted.
- Generated audio is not permanently stored server-side.
- Gmail metadata and Calendar event data are not persisted server-side.

## Current Risks

- This is a private personal MVP, not a public multi-tenant production launch.
- Generated outputs and transcripts in `localStorage` may contain sensitive information from email snippets or calendar context, so the browser/device should be treated as trusted.
- Saved Outputs used for Gmail drafts may contain sensitive generated content. Users must review drafts in Gmail before sending.
- Auth.js JWT cookie security depends on a strong `AUTH_SECRET`, HTTPS in production, and correct deployment configuration.
- OpenAI receives compacted metadata/snippets, generated transcript text, and Concierge prompts. Users should avoid entering highly sensitive content until a stricter data policy is finalized.
- There is no server-side audit log, abuse detection, rate limiting per user, or formal consent screen beyond Google OAuth.

## Before Public Launch

- Add server-side per-user rate limits and abuse protection on Google/OpenAI routes.
- Add a formal privacy policy, terms, and clear user consent copy.
- Complete Google OAuth app verification and publish only the minimal required scopes, including Gmail metadata, Gmail compose for drafts, and Calendar events read-only.
- Consider encrypted database storage only for explicit user-approved saved outputs.
- Add structured security logging that excludes tokens, secrets, prompts, email snippets, and full AI payloads.
- Add automated tests for unauthenticated API access, token refresh failure, and scope mismatch handling.
- Review OpenAI data processing settings and document retention behavior for users.
