import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { Resend } from "resend";

type Body = {
  to?: string;
  code?: string;
  title?: string;
  url?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __openseatMailer:
    | {
        transporter: nodemailer.Transporter;
        from: string;
      }
    | undefined;
}

async function etherealTransporter() {
  if (globalThis.__openseatMailer) return globalThis.__openseatMailer;
  const account = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass },
  });
  globalThis.__openseatMailer = {
    transporter,
    from: `"OpenSeat" <${account.user}>`,
  };
  return globalThis.__openseatMailer;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const to = (body.to || "").trim();
  const code = (body.code || "").trim();
  const title = (body.title || "").trim();
  const url = (body.url || "https://courses.yale.edu/").trim();

  if (!isEmail(to) || !code) {
    return NextResponse.json(
      { error: "Need a valid to email and course code" },
      { status: 400 },
    );
  }

  const subject = `OpenSeat: ${code} just opened`;
  const text = [
    `${code} — ${title || "a watched course"} just opened a seat.`,
    "",
    "Claim it now in Yale Course Search:",
    url,
    "",
    "OpenSeat never enrolls for you — this is an alert only.",
  ].join("\n");

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.5">
      <p style="font-size:18px;font-weight:700;margin:0 0 8px">${code} just opened</p>
      <p style="margin:0 0 16px;color:#333">${title || "A watched course"} has a seat available.</p>
      <p><a href="${url}" style="display:inline-block;background:#111;color:#d6ff4b;padding:10px 14px;text-decoration:none;font-weight:700">Open Yale Course Search</a></p>
      <p style="margin-top:24px;font-size:12px;color:#666">OpenSeat never enrolls for you — alert only.</p>
    </div>
  `;

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const resend = new Resend(resendKey);
    const from =
      process.env.EMAIL_FROM || "OpenSeat <onboarding@resend.dev>";
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      text,
      html,
    });
    if (error) {
      return NextResponse.json(
        { error: error.message, provider: "resend" },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      provider: "resend",
      id: data?.id ?? null,
    });
  }

  // Hackathon fallback: Ethereal catch inbox + preview URL (proves the send)
  try {
    const { transporter, from } = await etherealTransporter();
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    return NextResponse.json({
      ok: true,
      provider: "ethereal",
      previewUrl: previewUrl || null,
      note: "No RESEND_API_KEY — email landed in an Ethereal test inbox. Open previewUrl to show judges.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email send failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}