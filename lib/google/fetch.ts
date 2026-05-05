export class GoogleApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly reconnectRequired = false,
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

const MAX_RETRIES = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(status: number, message: string) {
  const lowerMessage = message.toLowerCase();
  return (
    status === 429 ||
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("too many concurrent requests") ||
    lowerMessage.includes("quota")
  );
}

function retryDelay(attempt: number) {
  return 400 * 2 ** attempt;
}

export async function fetchGoogleJson<T>(url: URL, accessToken: string): Promise<T> {
  let lastError: GoogleApiError | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await fetchGoogleJsonOnce<T>(url, accessToken);
    } catch (error) {
      if (!(error instanceof GoogleApiError)) throw error;
      lastError = error;

      if (!isRateLimitError(error.status, error.message) || attempt === MAX_RETRIES) {
        throw error;
      }

      await sleep(retryDelay(attempt));
    }
  }

  throw lastError ?? new GoogleApiError("Google API request failed.", 500);
}

async function fetchGoogleJsonOnce<T>(url: URL, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    const message = payload?.error?.message ?? payload?.error?.status ?? "Google API request failed.";

    throw new GoogleApiError(
      message,
      response.status,
      response.status === 401 || response.status === 403,
    );
  }

  return response.json() as Promise<T>;
}
