/** Safe upper bound for share URLs (WhatsApp / Telegram query length). */
const MAX_SHARE_CHARS = 1800;

export function truncateForShareMessage(text: string, max = MAX_SHARE_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 24)}\n…(truncated for share)`;
}

/**
 * Opens WhatsApp (app or web) with prefilled receipt text.
 * @see https://faq.whatsapp.com/general/chats/how-to-use-click-to-chat
 */
export function buildWhatsAppShareUrl(message: string): string {
  const text = truncateForShareMessage(message);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Telegram share URL with receipt text (optional URL left empty for text-only shares).
 */
export function buildTelegramShareUrl(message: string): string {
  const text = truncateForShareMessage(message);
  return `https://t.me/share/url?text=${encodeURIComponent(text)}`;
}
