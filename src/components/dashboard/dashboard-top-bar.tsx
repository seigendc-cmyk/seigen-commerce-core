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
    <header className="vendor-panel flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <h1 className="text-lg font-semibold text-white sm:text-xl">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-neutral-300">{subtitle}</p> : null}
      </div>
      <button
        type="button"
        onClick={async () => {
          await signOutVendorSession();
          router.push("/signin");
        }}
        className="vendor-btn-secondary-dark lg:hidden"
      >
        Sign out
      </button>
    </header>
  );
}
