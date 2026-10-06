import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Camera, CheckCircle2, XCircle, AlertTriangle, Gift, Keyboard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pdv/$eventId/retirada")({
  head: () => ({ meta: [{ title: "Retirada — Fest Vale Timóteo" }] }),
  component: Retirada,
});

type Resultado = {
  status: "ok" | "duplicado" | "cancelada" | "invalido";
  message: string;
  itens?: { nome: string; qtd: number }[];
  cortesia?: boolean;
  retirado_em?: string;
  ficha?: string;
};

const horaBrasilia = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/**
 * Balcão de retirada. Lê a ficha, FECHA a câmera e mostra o resultado em tela
 * cheia: verde (pode entregar), amarelo (já retirada) ou vermelho (inválida).
 * "Ler a próxima ficha" reabre a câmera.
 */
function Retirada() {
  const containerId = "leitor-retirada";
  const scannerRef = useRef<{ stop: () => Promise<void>; clear?: () => void } | null>(null);
  const ocupadoRef = useRef(false);

  const [rodando, setRodando] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [manual, setManual] = useState("");

  const parar = async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try { await s.stop(); } catch { /* já parado */ }
      try { s.clear?.(); } catch { /* ignora */ }
    }
    setRodando(false);
  };

  useEffect(() => () => { parar(); }, []);

  const consultar = async (bruto: string) => {
    const token = bruto.trim().toLowerCase();
    if (!token || ocupadoRef.current) return;
    ocupadoRef.current = true;
    setConferindo(true);
    await parar();
    try {
      const { data, error } = await supabase.rpc("pos_retirar", { _ticket_token: token });
      if (error) {
        setResultado({ status: "invalido", message: error.message });
      } else {
        setResultado(data as unknown as Resultado);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate((data as unknown as Resultado).status === "ok" ? 120 : [80, 60, 80]);
        }
      }
    } finally {
      setConferindo(false);
      setManual("");
    }
  };

  const iniciar = async () => {
    ocupadoRef.current = false;
    setResultado(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const leitor = new Html5Qrcode(containerId);
      scannerRef.current = leitor as unknown as { stop: () => Promise<void>; clear?: () => void };
      await leitor.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (texto: string) => { consultar(texto); },
        () => undefined,
      );
      setRodando(true);
    } catch (e) {
      console.error(e);
      scannerRef.current = null;
      toast.error("Não consegui abrir a câmera. Confira a permissão do navegador.");
    }
  };

  const proxima = () => {
    setResultado(null);
    iniciar();
  };

  const visual = !resultado ? null
    : resultado.status === "ok"
      ? { fundo: "bg-success", titulo: "PODE ENTREGAR", Icone: CheckCircle2 }
      : resultado.status === "duplicado"
        ? { fundo: "bg-primary", titulo: "FICHA JÁ RETIRADA", Icone: AlertTriangle }
        : { fundo: "bg-destructive", titulo: resultado.status === "cancelada" ? "VENDA CANCELADA" : "FICHA INVÁLIDA", Icone: XCircle };

  return (
    <div className="container mx-auto max-w-md px-4 py-6">
      <Link to="/pdv" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" />PDV
      </Link>

      <h1 className="font-display text-2xl font-bold">Balcão de retirada</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Leia o QR da ficha. Cada ficha vale uma unidade e só pode ser retirada uma vez.
      </p>

      <div className="mt-5 overflow-hidden rounded-2xl border border-border/60 bg-black">
        <div id={containerId} className="min-h-[240px] w-full" />
      </div>

      <Button className="mt-3 w-full" size="lg" onClick={rodando ? parar : iniciar} disabled={conferindo}>
        <Camera className="mr-2 h-5 w-5" />
        {conferindo ? "Conferindo…" : rodando ? "Parar câmera" : "Abrir câmera"}
      </Button>

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Keyboard className="h-3.5 w-3.5" />
          Ou digite o código impresso na ficha
        </div>
        <div className="flex gap-2">
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value.trim())}
            placeholder="ex.: A1B2C3D4E5F60718"
            className="font-mono uppercase"
          />
          <Button variant="outline" onClick={() => manual && consultar(manual)} disabled={conferindo}>Conferir</Button>
        </div>
      </div>

      {/* resultado em tela cheia, com a câmera já desligada */}
      {resultado && visual && (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center text-white ${visual.fundo}`}>
          <visual.Icone className="h-24 w-24" />
          <div className="mt-4 font-display text-4xl font-bold leading-tight">{visual.titulo}</div>

          {resultado.status === "ok" && resultado.itens?.map((i, n) => (
            <div key={n} className="mt-6 font-display text-3xl font-bold">
              {i.qtd > 1 ? `${i.qtd}× ` : ""}{i.nome}
            </div>
          ))}
          {resultado.ficha && resultado.status === "ok" && (
            <div className="mt-2 text-lg opacity-90">ficha {resultado.ficha}</div>
          )}
          {resultado.cortesia && resultado.status === "ok" && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold">
              <Gift className="h-4 w-4" />Cortesia
            </div>
          )}
          {resultado.status === "duplicado" && resultado.retirado_em && (
            <div className="mt-4 text-xl">Retirada às {horaBrasilia(resultado.retirado_em)}</div>
          )}
          {resultado.status !== "ok" && resultado.status !== "duplicado" && (
            <div className="mt-4 text-lg opacity-90">{resultado.message}</div>
          )}

          <Button size="lg" variant="secondary" className="mt-10 w-full max-w-xs text-lg font-bold text-foreground" onClick={proxima}>
            <Camera className="mr-2 h-5 w-5" />Ler a próxima ficha
          </Button>
          <button className="mt-4 text-sm underline opacity-80" onClick={() => setResultado(null)}>Fechar</button>
        </div>
      )}
    </div>
  );
}
