"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { TerminalCheckoutPage } from "@/modules/terminal/ui/terminal-checkout-page";

export default function TerminalCheckoutRoute() {
  const params = useParams();
  const code = typeof params?.accessCode === "string" ? params.accessCode : "";
  return (
    <div>
      <div className="px-3 pt-3">
        <Link href={`/terminal/${code}/cart`} className="text-sm font-semibold text-orange-600 hover:underline">
          ← Back to cart
        </Link>
      </div>
      <TerminalCheckoutPage />
    </div>
  );
}
