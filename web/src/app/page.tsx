import { Suspense } from "react";
import OpenSeatApp from "@/components/OpenSeatApp";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-8 py-16 text-muted">Loading OpenSeat…</div>
      }
    >
      <OpenSeatApp />
    </Suspense>
  );
}