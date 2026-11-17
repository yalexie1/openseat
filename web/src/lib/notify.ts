export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

function beep(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.stop(ctx.currentTime + 0.45);
    window.setTimeout(() => void ctx.close(), 600);
  } catch {
    /* audio blocked — ignore */
  }
}

function flashTitle(code: string): void {
  const previous = document.title;
  let i = 0;
  const id = window.setInterval(() => {
    document.title = i % 2 === 0 ? `🟢 ${code} OPEN` : previous;
    i += 1;
    if (i > 8) {
      window.clearInterval(id);
      document.title = previous;
    }
  }, 500);
}

export type PingResult = "notified" | "denied" | "unsupported";

/** Call from a click handler so permission + Notification count as a user gesture. */
export async function pingSeatOpen(course: {
  code: string;
  title: string;
  url: string;
}): Promise<PingResult> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    beep();
    flashTitle(course.code);
    return "unsupported";
  }

  const perm = await ensureNotificationPermission();
  beep();
  flashTitle(course.code);

  if (perm !== "granted") return "denied";

  try {
    const n = new Notification(`${course.code} just opened`, {
      body: `${course.title} — claim it in Yale Course Search now.`,
      tag: `openseat-${course.code}-${Date.now()}`,
      requireInteraction: true,
    });
    n.onclick = () => {
      window.focus();
      window.open(course.url, "_blank", "noopener,noreferrer");
      n.close();
    };
  } catch {
    return "denied";
  }

  return "notified";
}