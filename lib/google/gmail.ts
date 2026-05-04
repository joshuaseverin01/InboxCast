import { fetchGoogleJson } from "@/lib/google/fetch";
import type {
  BriefingContextFilters,
  GmailFullMessageContent,
  GmailMetadataMessage,
  GmailThreadContent,
  GmailThreadMessageContent,
} from "@/lib/google/types";

type GmailListResponse = {
  messages?: Array<{
    id: string;
    threadId: string;
  }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
};

type GmailMessageResponse = {
  id: string;
  threadId: string;
  labelIds?: string[];
  internalDate?: string;
  snippet?: string;
  payload?: GmailPayload;
};

type GmailThreadResponse = {
  id: string;
  messages?: GmailMessageResponse[];
};

type GmailPayload = {
  mimeType?: string;
  filename?: string;
  headers?: Array<{
    name: string;
    value: string;
  }>;
  body?: {
    data?: string;
    attachmentId?: string;
  };
  parts?: GmailPayload[];
};

export type GmailMetadataResult = {
  messages: GmailMetadataMessage[];
  resultSizeEstimate?: number;
  truncated: boolean;
};

const MAX_GMAIL_MESSAGES = 20;
const MAX_GMAIL_MESSAGES_TO_SCAN = 200;
const GMAIL_METADATA_CONCURRENCY = 2;
const MAX_FULL_EMAIL_CHARS = 8_000;
const MAX_THREAD_MESSAGES = 10;
const MAX_THREAD_MESSAGE_CHARS = 5_000;
const MAX_THREAD_TOTAL_CHARS = 25_000;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
) {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += concurrency) {
    const batch = items.slice(index, index + concurrency);
    results.push(...(await Promise.all(batch.map(mapper))));
  }

  return results;
}

function getHeaderFromPayload(payload: GmailPayload | undefined, headerName: string) {
  return (
    payload?.headers?.find((header) => header.name.toLowerCase() === headerName.toLowerCase())?.value ?? ""
  );
}

function getHeader(message: GmailMessageResponse, headerName: string) {
  return getHeaderFromPayload(message.payload, headerName);
}

function cleanSnippet(snippet?: string) {
  if (!snippet) return undefined;
  return snippet.replace(/\s+/g, " ").trim().slice(0, 240);
}

function decodeBase64Url(data?: string) {
  if (!data) return "";

  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function cleanBodyText(value: string, maxLength = MAX_FULL_EMAIL_CHARS) {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

function collectBodyParts(payload: GmailPayload | undefined, targetMimeType: "text/plain" | "text/html"): string[] {
  if (!payload) return [];

  const parts = payload.parts?.flatMap((part) => collectBodyParts(part, targetMimeType)) ?? [];
  const isAttachment = Boolean(payload.filename || payload.body?.attachmentId);
  const body = !isAttachment && payload.mimeType === targetMimeType ? decodeBase64Url(payload.body?.data) : "";

  return body ? [body, ...parts] : parts;
}

function extractBodyText(payload: GmailPayload | undefined) {
  const plainText = collectBodyParts(payload, "text/plain").join("\n\n");
  if (plainText.trim()) return cleanBodyText(plainText);

  const htmlText = collectBodyParts(payload, "text/html").map(stripHtml).join("\n\n");
  if (htmlText.trim()) return cleanBodyText(htmlText);

  return "";
}

function isNewsletter(message: GmailMessageResponse) {
  return Boolean(getHeader(message, "List-Unsubscribe"));
}

function toMetadataMessage(message: GmailMessageResponse): GmailMetadataMessage {
  const internalDateMs = Number(message.internalDate);
  const timestamp = Number.isFinite(internalDateMs) ? new Date(internalDateMs).toISOString() : new Date().toISOString();

  return {
    id: message.id,
    threadId: message.threadId,
    from: getHeader(message, "From") || "Unknown sender",
    subject: getHeader(message, "Subject") || "(No subject)",
    timestamp,
    date: getHeader(message, "Date") || timestamp,
    hasListUnsubscribe: Boolean(getHeader(message, "List-Unsubscribe")),
    snippet: cleanSnippet(message.snippet),
    labels: message.labelIds ?? [],
  };
}

function inSelectedRange(message: GmailMessageResponse, start: Date, end: Date) {
  const internalDateMs = Number(message.internalDate);
  if (!Number.isFinite(internalDateMs)) return false;
  return internalDateMs >= start.getTime() && internalDateMs <= end.getTime();
}

function passesFilters(message: GmailMessageResponse, filters: BriefingContextFilters) {
  const labels = message.labelIds ?? [];
  if (filters.includeUnreadOnly && !labels.includes("UNREAD")) return false;
  if (!filters.includePromotions && labels.includes("CATEGORY_PROMOTIONS")) return false;
  if (!filters.includeNewsletters && isNewsletter(message)) return false;
  return true;
}

async function listMessageRefs(accessToken: string, filters: BriefingContextFilters, pageToken?: string) {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("maxResults", "50");
  url.searchParams.set("fields", "messages(id,threadId),nextPageToken,resultSizeEstimate");
  if (filters.includeUnreadOnly) url.searchParams.append("labelIds", "UNREAD");
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  return fetchGoogleJson<GmailListResponse>(url, accessToken);
}

async function scanMessageMetadata(accessToken: string, start: Date, end: Date, filters: BriefingContextFilters) {
  const refs: Array<{ id: string; threadId: string }> = [];
  const details: GmailMessageResponse[] = [];
  let pageToken: string | undefined;
  let resultSizeEstimate: number | undefined;
  let scanned = 0;

  do {
    const response = await listMessageRefs(accessToken, filters, pageToken);
    const pageRefs = response.messages ?? [];
    resultSizeEstimate = response.resultSizeEstimate;
    refs.push(...pageRefs);
    pageToken = response.nextPageToken;

    const remaining = Math.max(0, MAX_GMAIL_MESSAGES_TO_SCAN - scanned);
    const pageDetails = await mapWithConcurrency(
      pageRefs.slice(0, remaining),
      GMAIL_METADATA_CONCURRENCY,
      (message) => getMessageMetadata(accessToken, message.id),
    );
    scanned += pageDetails.length;
    details.push(...pageDetails);

    const pageIsOlderThanRange =
      pageDetails.length > 0 &&
      pageDetails.every((message) => {
        const internalDateMs = Number(message.internalDate);
        return Number.isFinite(internalDateMs) && internalDateMs < start.getTime();
      });

    if (details.filter((message) => inSelectedRange(message, start, end)).length >= MAX_GMAIL_MESSAGES) break;
    if (pageIsOlderThanRange) break;
  } while (pageToken && scanned < MAX_GMAIL_MESSAGES_TO_SCAN);

  return {
    details,
    refs: refs.slice(0, MAX_GMAIL_MESSAGES),
    resultSizeEstimate,
    truncated: Boolean(pageToken) || scanned >= MAX_GMAIL_MESSAGES_TO_SCAN,
  };
}

async function getMessageMetadata(accessToken: string, id: string) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
  url.searchParams.set("format", "metadata");
  url.searchParams.append("metadataHeaders", "From");
  url.searchParams.append("metadataHeaders", "Subject");
  url.searchParams.append("metadataHeaders", "Date");
  url.searchParams.append("metadataHeaders", "List-Unsubscribe");
  url.searchParams.set("fields", "id,threadId,labelIds,internalDate,snippet,payload/headers");

  return fetchGoogleJson<GmailMessageResponse>(url, accessToken);
}

async function getFullMessage(accessToken: string, id: string) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
  url.searchParams.set("format", "full");
  url.searchParams.set("fields", "id,threadId,internalDate,payload");

  return fetchGoogleJson<GmailMessageResponse>(url, accessToken);
}

async function getFullThread(accessToken: string, threadId: string) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`);
  url.searchParams.set("format", "full");
  url.searchParams.set("fields", "id,messages(id,threadId,internalDate,payload)");

  return fetchGoogleJson<GmailThreadResponse>(url, accessToken);
}

function toFullMessageContent(message: GmailMessageResponse): GmailFullMessageContent {
  const internalDateMs = Number(message.internalDate);
  const timestamp = Number.isFinite(internalDateMs) ? new Date(internalDateMs).toISOString() : new Date().toISOString();

  return {
    body: extractBodyText(message.payload),
    date: getHeader(message, "Date") || timestamp,
    from: getHeader(message, "From") || "Unknown sender",
    id: message.id,
    subject: getHeader(message, "Subject") || "(No subject)",
    threadId: message.threadId,
    to: getHeader(message, "To") || undefined,
    timestamp,
  };
}

function timestampForMessage(message: GmailMessageResponse) {
  const internalDateMs = Number(message.internalDate);
  return Number.isFinite(internalDateMs) ? new Date(internalDateMs).toISOString() : new Date().toISOString();
}

function toThreadMessageContent(message: GmailMessageResponse): GmailThreadMessageContent {
  const timestamp = timestampForMessage(message);

  return {
    body: cleanBodyText(extractBodyText(message.payload), MAX_THREAD_MESSAGE_CHARS),
    date: getHeader(message, "Date") || timestamp,
    from: getHeader(message, "From") || "Unknown sender",
    id: message.id,
    subject: getHeader(message, "Subject") || "(No subject)",
    threadId: message.threadId,
    to: getHeader(message, "To") || undefined,
    timestamp,
  };
}

function extractEmailAddress(value: string) {
  const bracketed = value.match(/<([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>/);
  if (bracketed?.[1]) return bracketed[1].toLowerCase();

  return value.match(/[^\s<>,;]+@[^\s<>,;]+\.[^\s<>,;]+/)?.[0]?.toLowerCase() ?? "";
}

function capThreadBodyTotal(messages: GmailThreadMessageContent[]) {
  let remaining = MAX_THREAD_TOTAL_CHARS;

  return messages.map((message) => {
    if (remaining <= 0) return { ...message, body: "" };

    const body = message.body.slice(0, remaining);
    remaining -= body.length;
    return { ...message, body };
  });
}

function replyToForThread(messages: GmailThreadMessageContent[], userEmail?: string | null) {
  const normalizedUserEmail = userEmail?.toLowerCase() ?? "";
  const latestRelevant = [...messages]
    .reverse()
    .find((message) => extractEmailAddress(message.from) !== normalizedUserEmail);

  return latestRelevant?.from ?? messages.at(-1)?.from;
}

export async function fetchGmailMetadataForRange({
  accessToken,
  end,
  filters,
  start,
}: {
  accessToken: string;
  start: Date;
  end: Date;
  filters: BriefingContextFilters;
}): Promise<GmailMetadataResult> {
  const scanned = await scanMessageMetadata(accessToken, start, end, filters);
  const messages = scanned.details
    .filter((message) => inSelectedRange(message, start, end))
    .filter((message) => passesFilters(message, filters))
    .slice(0, MAX_GMAIL_MESSAGES)
    .map(toMetadataMessage)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    messages,
    resultSizeEstimate: scanned.resultSizeEstimate,
    truncated: scanned.truncated,
  };
}

export async function fetchSelectedGmailFullMessages({
  accessToken,
  messageIds,
}: {
  accessToken: string;
  messageIds: string[];
}): Promise<GmailFullMessageContent[]> {
  const messages: GmailFullMessageContent[] = [];

  for (const id of messageIds) {
    // Full content is fetched only for user-selected messages; attachments are not downloaded.
    messages.push(toFullMessageContent(await getFullMessage(accessToken, id)));
  }

  return messages;
}

export async function fetchSelectedGmailThread({
  accessToken,
  threadId,
  userEmail,
}: {
  accessToken: string;
  threadId: string;
  userEmail?: string | null;
}): Promise<GmailThreadContent> {
  const thread = await getFullThread(accessToken, threadId);
  const allMessages = (thread.messages ?? []).sort(
    (a, b) => new Date(timestampForMessage(a)).getTime() - new Date(timestampForMessage(b)).getTime(),
  );
  const selectedMessages = allMessages.slice(-MAX_THREAD_MESSAGES).map(toThreadMessageContent);
  const cappedMessages = capThreadBodyTotal(selectedMessages);
  const firstSubject = cappedMessages.find((message) => message.subject)?.subject ?? "(No subject)";

  return {
    messageCount: allMessages.length,
    messages: cappedMessages,
    replyTo: replyToForThread(cappedMessages, userEmail),
    subject: firstSubject,
    threadId: thread.id,
    truncated: allMessages.length > MAX_THREAD_MESSAGES,
  };
}
