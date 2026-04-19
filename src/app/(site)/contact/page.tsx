import { ContactForm } from "@/components/marketing/contact-form";
import { Section } from "@/components/marketing/section";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <Section
      title="Contact"
      subtitle="Reach the seiGEN Commerce team for pilots, enterprise design reviews, or partnership questions. This form is display-only in the local demo."
    >
      <ContactForm />
    </Section>
  );
}
