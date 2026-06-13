import type { Profile, SubmissionSummary, SubmitResponse, TutorResult } from "./types.js";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new ApiError(res.status, body.message ?? `request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

function pinHeader(): Record<string, string> {
  const pin = typeof localStorage !== "undefined" ? localStorage.getItem("hh_pin") : null;
  return pin ? { "x-hh-pin": pin } : {};
}

export function getConfig(): Promise<{ pinRequired: boolean }> {
  return fetch("/api/config").then((r) => unwrap<{ pinRequired: boolean }>(r));
}

export function checkPin(pin: string): Promise<boolean> {
  return fetch("/api/pin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pin }),
  }).then((r) => r.ok);
}

export function getProfiles(): Promise<Profile[]> {
  return fetch("/api/profiles").then((r) => unwrap<Profile[]>(r));
}

export function submitText(profileId: string, text: string): Promise<SubmitResponse> {
  return fetch("/api/submit", {
    method: "POST",
    headers: { "content-type": "application/json", ...pinHeader() },
    body: JSON.stringify({ profileId, text }),
  }).then((r) => unwrap<SubmitResponse>(r));
}

export function submitImage(profileId: string, file: File): Promise<SubmitResponse> {
  const body = new FormData();
  body.append("image", file);
  return fetch(`/api/submit?profileId=${encodeURIComponent(profileId)}`, {
    method: "POST",
    headers: pinHeader(),
    body,
  }).then((r) => unwrap<SubmitResponse>(r));
}

export function getHistory(profileId: string): Promise<SubmissionSummary[]> {
  return fetch(`/api/history?profileId=${encodeURIComponent(profileId)}`).then((r) =>
    unwrap<SubmissionSummary[]>(r)
  );
}

export function getSubmission(id: string): Promise<{ id: string; profileId: string; createdAt: string; result: TutorResult }> {
  return fetch(`/api/submission/${encodeURIComponent(id)}`).then((r) => unwrap(r));
}
