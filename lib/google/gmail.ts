import { fetchGoogleJson } from "@/lib/google/fetch";
import type { BriefingContextFilters, GmailMetadataMessage } from "@/lib/google/types";

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
  payload?: {
    headers?: Array<{
      name: string;
      value: string;
    }>;
  };
};

export type GmailMetadataResult = {
  messages: GmailMetadataMessage[];
  resultSizeEstimate?: number;
  truncated: boolean;
};

const MAX_GMAIL_MESSAGES = 20;
const MAX_GMAIL_MESSAGES_TO_SCAN = 200;
const GMAIL_METADATA_CONCURRENCY = 2;

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

function getHeader(message: GmailMessageResponse, headerName: string) {
  return (
    message.payload?.headers?.find((header) => header.name.toLowerCase() === headerName.toLowerCase())?.value ??
    ""
  );
}

function cleanSnippet(snippet?: string) {
  if (!snippet) return undefined;
  return snippet.replace(/\s+/g, " ").trim().slice(0, 240);
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
