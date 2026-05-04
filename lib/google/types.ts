export type BriefingContextFilters = {
  includeUnreadOnly: boolean;
  includeCalendar: boolean;
  includeNewsletters: boolean;
  includePromotions: boolean;
};

export type BriefingContextRequest = {
  start: string;
  end: string;
  filters: BriefingContextFilters;
};

export type GmailMetadataMessage = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  timestamp: string;
  date: string;
  snippet?: string;
  labels: string[];
  hasListUnsubscribe?: boolean;
};

export type GmailFullMessageContent = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  timestamp: string;
  body: string;
};

export type GoogleCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  descriptionSnippet?: string;
};

export type BriefingContextSummary = {
  emailCount: number;
  unreadEmailCount: number;
  importantEmailCount: number;
  calendarEventCount: number;
  calendarConflictCount: number;
};

export type BriefingContextResponse = {
  range: {
    start: string;
    end: string;
  };
  gmail: {
    messages: GmailMetadataMessage[];
    resultSizeEstimate?: number;
    truncated: boolean;
  };
  calendar: {
    events: GoogleCalendarEvent[];
    skipped: boolean;
  };
  summary: BriefingContextSummary;
  fetchedAt: string;
};

export type BriefingContextErrorCode =
  | "BAD_REQUEST"
  | "NOT_CONNECTED"
  | "MISSING_SCOPE"
  | "REFRESH_FAILED"
  | "GOOGLE_API_ERROR"
  | "SERVER_ERROR";

export type BriefingContextErrorResponse = {
  error: {
    code: BriefingContextErrorCode;
    message: string;
    reconnectRequired?: boolean;
    missingScopes?: string[];
  };
};

export type BriefingStyle = "concise" | "detailed" | "executive" | "casual podcast";
export type BriefingFocus = "full" | "action_only" | "skip_low_priority";

export type WrittenBriefing = {
  intro: string;
  priorityEmails: string[];
  actionItems: string[];
  calendarContext: string[];
  lowPriorityFYI: string[];
  suggestedNextSteps: string[];
  fullTranscript: string;
};

export type WrittenBriefingRequest = {
  context: BriefingContextResponse;
  style: BriefingStyle;
  focus?: BriefingFocus;
};

export type WrittenBriefingResponse = {
  briefing: WrittenBriefing;
};

export type WrittenBriefingErrorResponse = {
  error: {
    message: string;
  };
};
