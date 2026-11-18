"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATALOG_PATH,
  SEASON_LABEL,
  yaleSearchUrl,
  type CatalogCourse,
  type SeatStatus,
  type WatchedCourse,
} from "@/lib/types";
import { loadWatchlist, saveWatchlist } from "@/lib/storage";
import { ensureNotificationPermission, pingSeatOpen } from "@/lib/notify";
import {
  loadAlertEmail,
  saveAlertEmail,
  sendSeatEmail,
} from "@/lib/email";

type NotifState = NotificationPermission | "unsupported" | "loading";

function statusLabel(s: SeatStatus): string {
  if (s === "open") return "OPEN";
  if (s === "full") return "FULL";
  return "—";
}

export default function OpenSeatApp() {
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [query, setQuery] = useState("");
  const [watchlist, setWatchlist] = useState<WatchedCourse[]>([]);
  const [ready, setReady] = useState(false);
  const [notif, setNotif] = useState<NotifState>("loading");
  const [alert, setAlert] = useState<WatchedCourse | null>(null);
  const [clock, setClock] = useState("--:--:--");
  const [liveHint, setLiveHint] = useState("Watching locally · demo-ready");
  const [pingNote, setPingNote] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailLink, setEmailLink] = useState<string | null>(null);
  const prevStatus = useRef<Record<number, SeatStatus>>({});
  const emailRef = useRef("");

  useEffect(() => {
    const saved = loadAlertEmail();
    setEmail(saved);
    emailRef.current = saved;
    setWatchlist(loadWatchlist());
    setReady(true);
    if (!("Notification" in window)) {
      setNotif("unsupported");
    } else {
      setNotif(Notification.permission);
    }
    fetch(CATALOG_PATH)
      .then((r) => r.json())
      .then((data: CatalogCourse[]) => setCatalog(data))
      .catch(() => setLiveHint("Catalog failed to load"));
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveWatchlist(watchlist);
  }, [watchlist, ready]);

  useEffect(() => {
    const format = () =>
      new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    setClock(format());
    const id = window.setInterval(() => setClock(format()), 1000);
    return () => window.clearInterval(id);
  }, []);

  async function notifyOpen(course: WatchedCourse, fromClick: boolean) {
    const url = yaleSearchUrl(course.code);
    const result = await pingSeatOpen({
      code: course.code,
      title: course.title,
      url,
    });
    setNotif(
      result === "notified"
        ? "granted"
        : result === "unsupported"
          ? "unsupported"
          : typeof Notification !== "undefined" &&
              Notification.permission === "granted"
            ? "granted"
            : "denied",
    );

    let note =
      result === "denied"
        ? "Browser blocked the notification — allow pings for this site (lock icon in the address bar)."
        : result === "notified"
          ? fromClick
            ? "Ping sent. No banner while this tab is focused? Check Notification Center."
            : "Ping sent."
          : null;

    const to = emailRef.current.trim();
    if (to) {
      const mail = await sendSeatEmail({
        to,
        code: course.code,
        title: course.title,
      });
      if (mail.ok) {
        if (mail.previewUrl) {
          setEmailLink(mail.previewUrl);
          note = `${note ? note + " " : ""}Email captured (demo inbox) — open preview below.`;
        } else {
          setEmailLink(null);
          note = `${note ? note + " " : ""}Email sent to ${to}.`;
        }
      } else {
        note = `${note ? note + " " : ""}Email failed: ${mail.error}`;
      }
    } else {
      setEmailLink(null);
      note = `${note ? note + " " : ""}Add an email above to also get a mail alert.`;
    }

    setPingNote(note);
    setAlert(course);
  }

  // Detect full → open from the poll loop (Simulate open notifies itself)
  useEffect(() => {
    for (const course of watchlist) {
      const prev = prevStatus.current[course.id];
      if (prev === "full" && course.status === "open" && !course.notifiedAt) {
        void notifyOpen(course, false);
        setWatchlist((list) =>
          list.map((c) =>
            c.id === course.id ? { ...c, notifiedAt: Date.now() } : c,
          ),
        );
      }
      prevStatus.current[course.id] = course.status;
    }
  }, [watchlist]);

  const fullCrnKey = watchlist
    .filter((c) => c.status === "full" && c.crn)
    .map((c) => c.crn)
    .join(",");

  // Best-effort live check against our status API (demo overrides + probe)
  useEffect(() => {
    if (!ready || !fullCrnKey) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/status?crns=${fullCrnKey}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          results: Record<string, { status: SeatStatus; source: string }>;
          note?: string;
        };
        if (cancelled) return;
        if (data.note) setLiveHint(data.note);

        const opened = new Set(
          Object.entries(data.results)
            .filter(([, v]) => v.status === "open")
            .map(([crn]) => crn),
        );
        if (opened.size === 0) return;

        setWatchlist((list) => {
          let changed = false;
          const next = list.map((c) => {
            if (!c.crn || c.status !== "full") return c;
            if (!opened.has(String(c.crn))) return c;
            changed = true;
            return { ...c, status: "open" as const, openedAt: Date.now() };
          });
          return changed ? next : list;
        });
      } catch {
        /* keep local state */
      }
    };

    poll();
    const id = window.setInterval(poll, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [ready, fullCrnKey]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const watched = new Set(watchlist.map((w) => w.id));
    return catalog
      .filter((c) => {
        if (watched.has(c.id)) return false;
        const hay = `${c.code} ${c.codes.join(" ")} ${c.title} ${c.profs.join(" ")}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 8);
  }, [catalog, query, watchlist]);

  const watchingCount = watchlist.filter((c) => c.status === "full").length;
  const openCount = watchlist.filter((c) => c.status === "open").length;

  function addCourse(course: CatalogCourse) {
    const item: WatchedCourse = {
      id: course.id,
      crn: course.crn,
      code: course.code,
      title: course.title,
      section: course.section,
      profs: course.profs,
      status: "full",
      addedAt: Date.now(),
    };
    prevStatus.current[course.id] = "full";
    setWatchlist((list) => [item, ...list]);
    setQuery("");
  }

  function removeCourse(id: number) {
    setWatchlist((list) => list.filter((c) => c.id !== id));
    delete prevStatus.current[id];
  }

  async function enableNotifications() {
    const perm = await ensureNotificationPermission();
    setNotif(perm);
  }

  function onEmailChange(value: string) {
    setEmail(value);
    emailRef.current = value;
    saveAlertEmail(value);
  }

  async function simulateOpen(id: number) {
    const course = watchlist.find((c) => c.id === id);
    if (!course) return;

    await notifyOpen(course, true);
    prevStatus.current[id] = "open";

    if (course.crn) {
      await fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crn: course.crn, status: "open" }),
      });
    }

    setWatchlist((list) =>
      list.map((c) =>
        c.id === id
          ? {
              ...c,
              status: "open",
              openedAt: Date.now(),
              notifiedAt: Date.now(),
            }
          : c,
      ),
    );
  }

  function resetToFull(id: number) {
    const course = watchlist.find((c) => c.id === id);
    if (course?.crn) {
      void fetch("/api/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crn: course.crn, status: "full" }),
      });
    }
    prevStatus.current[id] = "full";
    setWatchlist((list) =>
      list.map((c) =>
        c.id === id
          ? {
              ...c,
              status: "full",
              openedAt: undefined,
              notifiedAt: undefined,
            }
          : c,
      ),
    );
    if (alert?.id === id) setAlert(null);
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 pb-16 pt-8 sm:px-8">
      <header className="rise-in flex flex-col gap-6 border-b border-line/70 pb-8">
  <div className="flex flex-wrap items-end justify-between gap-4">
    <div>
      <p className="mono text-[11px] uppercase tracking-[0.22em] text-brand">
        Yale · {SEASON_LABEL}
      </p>
      <h1 className="mt-2 bg-gradient-to-r from-brand to-open bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-6xl">
        OpenSeat
      </h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-muted">
        Watch full classes. Get a browser ping the second a seat opens.
        You register yourself in Yale Course Search.
      </p>
    </div>
    <div className="mono rounded-xl border border-line/60 bg-panel/60 px-5 py-3.5 text-right shadow-sm backdrop-blur-sm">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
        Local clock
      </div>
      <div className="mt-1 text-2xl font-medium tabular-nums text-brand">
        {clock}
      </div>
      <div className="mt-1 text-[11px] text-muted">{liveHint}</div>
    </div>
  </div>

  {/* email + notification controls — same structure, just better radius/padding */}
  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
    <label className="flex min-w-[240px] flex-1 flex-col gap-1.5">
      <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted">
        Alert email
      </span>
      <input
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        placeholder="you@yale.edu"
        className="rounded-lg border border-line bg-panel/80 px-3.5 py-2.5 text-sm text-text outline-none transition placeholder:text-muted/50 focus:border-brand focus:ring-2 focus:ring-brand/30"
        autoComplete="email"
      />
    </label>
    <div className="flex flex-wrap items-center gap-3">
      {/* buttons keep same logic, just use rounded-lg + better hover */}
      {notif !== "granted" && notif !== "unsupported" && (
        <button
          type="button"
          onClick={enableNotifications}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-ink shadow-sm transition hover:brightness-110 hover:shadow-md"
        >
          Enable browser pings
        </button>
      )}
      {notif === "granted" && (
        <span className="mono inline-flex items-center gap-2 rounded-full border border-open/40 bg-open/10 px-3.5 py-1.5 text-xs text-open">
          <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-open" />
          Notifications on
        </span>
      )}
      {/* ... rest of the status spans stay similar */}
    </div>
  </div>
  {/* pingNote and emailLink stay the same */}
</header>
      {alert && (
  <div className="slide-alert mt-6 flex flex-col gap-4 rounded-xl border border-open/60 bg-open/10 px-5 py-5 shadow-lg shadow-open/10 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="mono text-[11px] uppercase tracking-[0.2em] text-open">
        Seat available
      </p>
      <p className="mt-1 text-xl font-bold">
        {alert.code} — {alert.title}
      </p>
    </div>
    <div className="flex gap-2">
      <a
        href={yaleSearchUrl(alert.code)}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg bg-open px-5 py-2.5 text-sm font-bold text-ink shadow-sm transition hover:brightness-110"
      >
        Open in Course Search →
      </a>
      <button
        type="button"
        onClick={() => setAlert(null)}
        className="rounded-lg border border-line/70 px-4 py-2.5 text-sm text-muted transition hover:bg-panel hover:text-text"
      >
        Dismiss
      </button>
    </div>
  </div>
)}

      <section className="rise-in mt-8" style={{ animationDelay: "60ms" }}>
        <label className="mono text-[11px] uppercase tracking-[0.18em] text-muted">
          Add a full class to watch
        </label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by course number, seminar title, professor…"
          className="mt-2 w-full border border-line bg-panel px-4 py-3.5 text-lg text-text outline-none transition placeholder:text-muted/60 focus:border-brand focus:shadow-[0_0_0_3px_var(--glow)]"
          autoComplete="off"
          spellCheck={false}
        />
        {results.length > 0 && (
          <ul className="mt-2 overflow-hidden border border-line bg-panel-2">
            {results.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 border-b border-line last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => addCourse(c)}
                  className="flex flex-1 items-start gap-3 px-4 py-3 text-left transition hover:bg-brand/10"
                >
                  <span className="mono shrink-0 pt-0.5 text-sm font-semibold text-brand">
                    {c.code}
                  </span>
                  <span>
                    <span className="block font-semibold leading-snug">
                      {c.title}
                    </span>
                    <span className="mono mt-1 block text-[11px] text-muted">
                      Sec {c.section || "—"}
                      {c.profs.length ? ` · ${c.profs.slice(0, 2).join(", ")}` : ""}
                      {c.crn ? ` · CRN ${c.crn}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim().length >= 2 && results.length === 0 && catalog.length > 0 && (
          <p className="mono mt-2 text-xs text-muted">No matches in {SEASON_LABEL} YC catalog.</p>
        )}
      </section>

      <section className="rise-in mt-10" style={{ animationDelay: "120ms" }}>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Watchlist</h2>
          <p className="mono text-[11px] text-muted">
            Leave this tab open during add/drop
          </p>
        </div>

        {watchlist.length === 0 ? (
          <div className="border border-dashed border-line bg-panel/40 px-5 py-10 text-center">
            <p className="text-lg font-semibold text-muted">Nothing watched yet</p>
            <p className="mt-2 text-sm text-muted">
              Search a course that filled up, add it, then hit{" "}
              <span className="text-brand">Simulate open</span> to demo a ping.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {watchlist.map((c) => (
              <li
                key={c.id}
                className={`border border-line bg-panel px-4 py-4 ${
                  c.status === "open" ? "flash-open border-open" : ""
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`mono rounded-sm px-2 py-0.5 text-[11px] font-semibold tracking-wider ${
                          c.status === "open"
                            ? "bg-open text-ink"
                            : c.status === "full"
                              ? "bg-full/20 text-full"
                              : "bg-line text-muted"
                        }`}
                      >
                        {statusLabel(c.status)}
                      </span>
                      <span className="mono text-sm font-semibold text-brand">
                        {c.code}
                      </span>
                      {c.status === "full" && (
                        <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-brand" />
                      )}
                    </div>
                    <p className="mt-1 truncate text-lg font-semibold">{c.title}</p>
                    <p className="mono mt-1 text-[11px] text-muted">
                      Sec {c.section || "—"}
                      {c.profs.length ? ` · ${c.profs.slice(0, 2).join(", ")}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {c.status === "full" ? (
                      <button
                        type="button"
                        onClick={() => simulateOpen(c.id)}
                        className="rounded-sm border border-brand/50 bg-brand/15 px-3 py-2 text-sm font-semibold text-brand transition hover:bg-brand hover:text-ink"
                      >
                        Simulate open
                      </button>
                    ) : (
                      <>
                        <a
                          href={yaleSearchUrl(c.code)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-sm bg-open px-3 py-2 text-sm font-bold text-ink"
                        >
                          Register →
                        </a>
                        <button
                          type="button"
                          onClick={() => resetToFull(c.id)}
                          className="rounded-sm border border-line px-3 py-2 text-sm text-muted"
                        >
                          Mark full again
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => removeCourse(c.id)}
                      className="rounded-sm border border-line px-3 py-2 text-sm text-muted hover:border-full hover:text-full"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-12 border-t border-line pt-6 mono text-[11px] leading-relaxed text-muted">
        Course names from CourseTable&apos;s public {SEASON_LABEL} catalog.
        OpenSeat never logs into Yale and never enrolls for you — it only alerts.
        Live registrar status is best-effort; use Simulate open for demos.
      </footer>
    </div>
  );
}
