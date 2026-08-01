"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** One server-authorized verification attempt after returning from a provider. */
export function PaymentStatusVerifier({ orderId }: { orderId: string }) {
  const router = useRouter();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void fetch("/api/payments/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    }).then((response) => {
      if (response.ok) router.refresh();
    }).catch(() => undefined);
  }, [orderId, router]);
  return null;
}
