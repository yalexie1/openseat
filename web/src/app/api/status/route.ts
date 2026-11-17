import { NextRequest, NextResponse } from "next/server";

type SeatStatus = "full" | "open" | "unknown";

type StatusEntry = {
  status: SeatStatus;
  source: "demo" | "probe" | "none";
  updatedAt: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __openseatStatus: Map<string, StatusEntry> | undefined;
}

function store(): Map<string, StatusEntry> {
  if (!globalThis.__openseatStatus) {
    globalThis.__openseatStatus = new Map();
  }
  return globalThis.__openseatStatus;
}

export async function GET(req: NextRequest) {
  const crns = (req.nextUrl.searchParams.get("crns") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const results: Record<string, StatusEntry> = {};
  const map = store();

  for (const crn of crns) {
    const hit = map.get(crn);
    results[crn] = hit ?? {
      status: "unknown",
      source: "none",
      updatedAt: Date.now(),
    };
  }

  // Soft probe: Yale Course Search sits behind a WAF from most servers.
  // We keep the route so the client has a real poll loop; demo overrides win.
  return NextResponse.json({
    results,
    note:
      "Watching via demo overrides · Yale Course Search blocks server probes (WAF)",
  });
}

export async function POST(req: NextRequest) {
  let body: { crn?: number | string; status?: SeatStatus };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const crn = body.crn != null ? String(body.crn) : "";
  const status = body.status;
  if (!crn || (status !== "open" && status !== "full" && status !== "unknown")) {
    return NextResponse.json(
      { error: "Need crn and status (open|full|unknown)" },
      { status: 400 },
    );
  }

  const entry: StatusEntry = {
    status,
    source: "demo",
    updatedAt: Date.now(),
  };
  store().set(crn, entry);
  return NextResponse.json({ ok: true, crn, ...entry });
}