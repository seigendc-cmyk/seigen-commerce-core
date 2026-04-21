"use client";

import { useRouter } from "next/navigation";
import { signOutVendorSession } from "@/lib/auth/sign-out-client";

export function DashboardTopBar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-20 flex flex-col gap-3 border-b border-slate-200/95 bg-white/90 px-4 py-4 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <h1 className="font-heading text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p> : null}
      </div>
      <button
        type="button"
        onClick={async () => {
          await signOutVendorSession();
          router.push("/signin");
        }}
        className="vc-btn-secondary px-3 py-2 text-sm lg:hidden"
      >
        Sign out
      </button>
    </header>
  );
}
