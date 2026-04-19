import { Section } from "@/components/marketing/section";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <Section
      title="About seiGEN Commerce"
      subtitle="We are rebuilding the vendor workspace around clarity, modularity, and local-first development—so your teams can ship features without fighting the platform."
    >
      <div className="max-w-2xl space-y-4 text-base leading-relaxed text-neutral-600">
        <p>
          This core is intentionally narrow: navigation, plans, onboarding shell, and a dashboard
          frame that will host inventory and POS. Integrations like Supabase auth and analytics
          arrive only when you are ready to wire them.
        </p>
        <p>
          The experience is optimized for corporate operations teams and store operators—not
          consumer window shopping. Orange signals action; charcoal grounds the interface in focus.
        </p>
      </div>
    </Section>
  );
}
