import { MessageCircle } from 'lucide-react';

export default function WhatsAppButton() {
  const number = import.meta.env.VITE_WHATSAPP_NUMBER || '8801XXXXXXXXX';
  return (
    <a
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noreferrer"
      className="no-print fixed bottom-6 right-6 z-40 flex items-center justify-center h-14 w-14 rounded-full bg-green-500 text-white shadow-lg hover:bg-green-600 transition hover:scale-105"
      title="WhatsApp Support"
    >
      <MessageCircle size={26} />
    </a>
  );
}
