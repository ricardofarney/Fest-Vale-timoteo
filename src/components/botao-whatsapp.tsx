import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { FEST, linkWhatsapp } from "@/lib/fest";

/**
 * Botão flutuante que abre a conversa no WhatsApp.
 *
 * Não há API da Meta por trás: o botão só abre o aplicativo com uma mensagem
 * já escrita, e quem responde é uma pessoa. Foi decisão do projeto — o custo
 * por mensagem da API oficial não se justifica no volume do evento.
 *
 * Se o número ainda não estiver cadastrado em FEST.contato.whatsapp, o botão
 * não aparece. Nada de link quebrado no ar.
 */
export function BotaoWhatsapp() {
  const [visivel, setVisivel] = useState(false);
  const [dispensado, setDispensado] = useState(false);
  const href = linkWhatsapp(FEST.whatsappMensagens.geral);

  // Só entra depois de uma rolagem curta: no primeiro instante da página o
  // botão competiria com o "Garantir meu ingresso", que é o que importa.
  useEffect(() => {
    const aoRolar = () => setVisivel(window.scrollY > 420);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  if (!href || dispensado) return null;

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 transition-all duration-300 ${
        visivel ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <button
        type="button"
        aria-label="Esconder o botão do WhatsApp"
        onClick={() => setDispensado(true)}
        className="rounded-full bg-background/80 p-1.5 text-muted-foreground shadow ring-1 ring-border/60 backdrop-blur transition-colors hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3.5 font-semibold text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:inline">Falar com a gente</span>
      </a>
    </div>
  );
}

/**
 * Link simples de WhatsApp, para usar dentro de texto ou como botão comum.
 * Devolve null quando o número não está cadastrado.
 */
export function LinkWhatsapp({
  mensagem,
  className,
  children,
}: {
  mensagem?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const href = linkWhatsapp(mensagem);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  );
}
