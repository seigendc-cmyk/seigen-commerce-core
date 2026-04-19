"use client";

export function ContactForm() {
  return (
    <form
      className="max-w-xl space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
      onSubmit={(e) => e.preventDefault()}
    >
      <div>
        <label className="block text-sm font-medium text-neutral-700" htmlFor="company">
          Company
        </label>
        <input
          id="company"
          name="company"
          className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-brand-orange focus:ring-2"
          placeholder="Your organization"
          autoComplete="organization"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700" htmlFor="email">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-brand-orange focus:ring-2"
          placeholder="you@company.com"
          autoComplete="email"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700" htmlFor="message">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-brand-orange focus:ring-2"
          placeholder="How can we help?"
        />
      </div>
      <p className="text-xs text-neutral-500">
        Backend not connected—submissions are ignored until integrations are added.
      </p>
      <button
        type="submit"
        className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover"
      >
        Send (demo)
      </button>
    </form>
  );
}
