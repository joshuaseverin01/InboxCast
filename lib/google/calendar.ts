import { fetchGoogleJson } from "@/lib/google/fetch";
import type { GoogleCalendarEvent } from "@/lib/google/types";

type CalendarEventsResponse = {
  items?: Array<{
    id: string;
    summary?: string;
    start?: {
      date?: string;
      dateTime?: string;
    };
    end?: {
      date?: string;
      dateTime?: string;
    };
    location?: string;
    description?: string;
  }>;
};

function cleanDescriptionSnippet(description?: string) {
  if (!description) return undefined;
  return description
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function eventTime(value?: { date?: string; dateTime?: string }) {
  return value?.dateTime ?? value?.date ?? "";
}

export function countCalendarConflicts(events: GoogleCalendarEvent[]) {
  const timedEvents = events
    .map((event) => ({
      start: new Date(event.start).getTime(),
      end: new Date(event.end).getTime(),
    }))
    .filter((event) => Number.isFinite(event.start) && Number.isFinite(event.end))
    .sort((a, b) => a.start - b.start);

  let conflicts = 0;

  for (let index = 1; index < timedEvents.length; index += 1) {
    if (timedEvents[index].start < timedEvents[index - 1].end) {
      conflicts += 1;
    }
  }

  return conflicts;
}

export async function fetchCalendarEventsForRange({
  accessToken,
  end,
  start,
}: {
  accessToken: string;
  start: Date;
  end: Date;
}): Promise<GoogleCalendarEvent[]> {
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", start.toISOString());
  url.searchParams.set("timeMax", end.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "50");
  url.searchParams.set("fields", "items(id,summary,start,end,location,description)");

  const response = await fetchGoogleJson<CalendarEventsResponse>(url, accessToken);

  return (response.items ?? []).map((event) => ({
    id: event.id,
    title: event.summary || "(No title)",
    start: eventTime(event.start),
    end: eventTime(event.end),
    location: event.location,
    descriptionSnippet: cleanDescriptionSnippet(event.description),
  }));
}
