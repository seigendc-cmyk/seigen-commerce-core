import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata = { title: "Sign up" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <SignUpForm planFromQuery={sp.plan} />
    </div>
  );
}
