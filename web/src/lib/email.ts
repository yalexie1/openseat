import { yaleSearchUrl } from "./types";

const EMAIL_KEY = "openseat-alert-email";

export function loadAlertEmail(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(EMAIL_KEY) || "";
}

export function saveAlertEmail(email: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(EMAIL_KEY, email.trim());
}

export type EmailSendResult = {
  ok: boolean;
  provider?: string;
  previewUrl?: string | null;
  note?: string;
  error?: string;
};

export async function sendSeatEmail(opts: {
  to: string;
  code: string;
  title: string;
}): Promise<EmailSendResult> {
  const to = opts.to.trim();
  if (!to) return { ok: false, error: "No email set" };

  try {
    const res = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        code: opts.code,
        title: opts.title,
        url: yaleSearchUrl(opts.code),
      }),
    });
    const data = (await res.json()) as EmailSendResult & { error?: string };
    if (!res.ok) {
      return { ok: false, error: data.error || "Email failed" };
    }
    return {
      ok: true,
      provider: data.provider,
      previewUrl: data.previewUrl,
      note: data.note,
    };
  } catch {
    return { ok: false, error: "Network error sending email" };
  }
}