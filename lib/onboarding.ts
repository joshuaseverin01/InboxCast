export const onboardingCompleteStorageKey = "inboxcast_onboarding_complete";

export function isOnboardingComplete() {
  if (typeof window === "undefined") return true;

  try {
    return window.localStorage.getItem(onboardingCompleteStorageKey) === "true";
  } catch {
    return true;
  }
}

export function markOnboardingComplete() {
  window.localStorage.setItem(onboardingCompleteStorageKey, "true");
}

export function resetOnboarding() {
  window.localStorage.removeItem(onboardingCompleteStorageKey);
}
