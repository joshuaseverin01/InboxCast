type OpenAIErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    type?: string;
  };
};

export function openAIProviderErrorMessage(
  status: number,
  fallback: string,
  payload?: OpenAIErrorPayload | null,
) {
  const detail = [payload?.error?.code, payload?.error?.type, payload?.error?.message]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (status === 401) {
    return "OpenAI authentication failed. Check OPENAI_API_KEY in the server environment.";
  }

  if (status === 402 || detail.includes("billing") || detail.includes("quota")) {
    return "OpenAI quota or billing needs attention before this can run.";
  }

  if (status === 429) {
    return "OpenAI rate limit reached. Wait a moment, then try again.";
  }

  return fallback;
}
