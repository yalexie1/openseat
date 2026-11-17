import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT_DIR = path.resolve("docs/demo-raw");
const FINAL_WEBM = path.resolve("docs/openseat-demo.webm");
const BASE = process.env.OPENSEAT_URL || "https://openseat.vercel.app";

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 800 } },
  permissions: ["notifications"],
});

const page = await context.newPage();

async function pause(ms) {
  await page.waitForTimeout(ms);
}

try {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await pause(1200);

  // Clear any prior watchlist / set email
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload({ waitUntil: "networkidle" });
  await pause(800);

  const email = page.getByPlaceholder("you@yale.edu");
  await email.click();
  await email.fill("yalexie@gmail.com");
  await pause(600);

  const enable = page.getByRole("button", { name: /Enable browser pings/i });
  if (await enable.count()) {
    await enable.click();
    await pause(800);
  }

  const search = page.getByPlaceholder(/Search CPSC/i);
  await search.click();
  await search.fill("phil 1176");
  await pause(1200);

  const hit = page.getByRole("button", { name: /PHIL 1176/i }).first();
  await hit.waitFor({ state: "visible", timeout: 15000 });
  await hit.click();
  await pause(1500);

  const simulate = page.getByRole("button", { name: /Simulate open/i });
  await simulate.waitFor({ state: "visible", timeout: 10000 });
  await simulate.click();
  await pause(3500);

  // Scroll alert into view if needed
  const alert = page.getByText(/Seat available/i);
  if (await alert.count()) {
    await alert.first().scrollIntoViewIfNeeded();
    await pause(2000);
  }

  await pause(1500);
} finally {
  const videoPath = await page.video().path();
  await context.close();
  await browser.close();

  if (videoPath && fs.existsSync(videoPath)) {
    fs.copyFileSync(videoPath, FINAL_WEBM);
    console.log("Wrote", FINAL_WEBM);
  } else {
    console.error("No video recorded");
    process.exit(1);
  }
}
