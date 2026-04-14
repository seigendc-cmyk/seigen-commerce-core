import { getUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  const user = await getUser();

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Dashboard
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Signed in as{" "}
        <span className="font-medium text-zinc-800 dark:text-zinc-200">
          {user?.email ?? "—"}
        </span>
      </p>
      <p className="pt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        SCI Core shell is ready. Product areas (Console, Executive, iTred, iDeliver)
        will plug in here as the monolith grows.
      </p>
    </div>
  );
}
