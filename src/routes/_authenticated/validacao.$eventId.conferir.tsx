import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Camera, CheckCircle2, AlertTriangle, XCircle, SearchCheck } from "lucide-react";
import { toast } from "sonner";

/**
 * Conferência de ingresso impresso — lê o QR e mostra número, lote e situação
 * SEM registrar entrada. Serve para testar os ingressos que saem da gráfica.
 * O teste fica anotado à parte (tabela ingressos_testes) e o ingresso continua
 * valendo normalmente na portaria.
 */
export const Route = createFileRoute("/_authenticated/validacao/$eventId/conferir")({
  head: () => ({ meta: [{ title: "Conferir ingressos impressos — Fest Vale Timóteo" }] }),
  component: Conferir,
});

type Resultado = {
  status: "valido" | "ja_usado" | "cancelado" | "nao_pago" | "outro_evento" | "invalido" | "erro";
  message?: string;
  numero?: number | null;
  lote?: string;
  tipo?: string;
  checked_in_at?: string | null;
  testes_anteriores?: number;
  lido_em?: string;
};

const numeroTxt = (n?: number | null) => (n ? `Nº ${String(n).padStart(4, "0")}` : "");

const TRAVA_MESMO_CODIGO_MS = 5_000;

function Conferir() {
  const { eventId } = Route.useParams();
  const containerId = "qr-conferir";
  const scannerRef = useRef<any>(null);
  const ultimoRef = useRef<{ token: string; at: number }>({ token: "", at: 0 });
  const ocupadoRef = useRef(false);
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [lidos, setLidos] = useState<Array<{ numero: number | null; lote?: string; status: Resultado["status"] }>>([]);
  const [evName, setEvName] = useState("");

  useEffect(() => {
    supabase.from("events").select("name").eq("id", eventId).single().then(({ data }) => {
      if (data) setEvName(data.name);
    });
  }, [eventId]);

  const parar = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* ignore */ }
      try { scannerRef.current.clear?.(); } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setRodando(false);
  };

  useEffect(() => () => { parar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const iniciar = async () => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const h = new Html5Qrcode(containerId);
      scannerRef.current = h;
      await h.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (texto) => ler(texto),
        () => undefined,
      );
      setRodando(true);
    } catch (e) {
      toast.error("Não consegui acessar a câmera. Verifique a permissão.");
      console.error(e);
    }
  };

  const ler = async (token: string) => {
    const agora = Date.now();
    if (token === ultimoRef.current.token && agora - ultimoRef.current.at < TRAVA_MESMO_CODIGO_MS) return;
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    ultimoRef.current = { token, at: agora };
    const lido_em = new Date().toLocaleTimeString("pt-BR");
    try {
      if (!navigator.onLine) {
        setResultado({ status: "erro", message: "Sem internet. A conferência precisa de conexão.", lido_em });
        return;
      }
      const rpc = supabase.rpc.bind(supabase) as unknown as (
        fn: string, args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await rpc("conferir_ingresso", { _qr_token: token, _event_id: eventId });
      if (error) {
        ultimoRef.current = { token: "", at: 0 };
        setResultado({ status: "erro", message: error.message, lido_em });
        return;
      }
      const r = { ...(data as Resultado), lido_em };
      setResultado(r);
      setLidos((l) => [{ numero: r.numero ?? null, lote: r.lote, status: r.status }, ...l].slice(0, 200));
    } finally {
      ocupadoRef.current = false;
    }
  };

  const okNaSessao = lidos.filter((l) => l.status === "valido").length;
  const problemas = lidos.filter((l) => l.status !== "valido").length;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Link to="/validacao" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" />Voltar
      </Link>

      <h1 className="font-display text-2xl font-bold">Conferir ingressos impressos</h1>
      <p className="text-sm text-muted-foreground">{evName}</p>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm">
        <SearchCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
        <p>
          <span className="font-semibold">Modo conferência: não registra entrada.</span> Lê o QR e mostra o número
          e o lote; o ingresso continua valendo normalmente na portaria. No dia do evento, use o{" "}
          <Link to="/validacao/$eventId/scanner" params={{ eventId }} className="underline">Scanner</Link>.
        </p>
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="relative aspect-square w-full bg-black">
          <div id={containerId} className="absolute inset-0" />
          {resultado && (
            <div className="absolute inset-x-0 bottom-0 z-10 p-3">
              <Banner r={resultado} />
            </div>
          )}
        </div>
        <div className="border-t border-border/60 p-3">
          {rodando ? (
            <Button variant="outline" className="w-full" onClick={parar}>Parar câmera</Button>
          ) : (
            <Button className="w-full" onClick={iniciar}><Camera className="mr-2 h-4 w-4" />Iniciar câmera</Button>
          )}
        </div>
      </Card>

      {lidos.length > 0 && (
        <Card className="mt-4 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">Conferidos agora</h2>
            <span className="text-sm text-muted-foreground">
              {okNaSessao} ok{problemas > 0 && <span className="text-destructive"> · {problemas} com problema</span>}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {lidos.map((l, i) => (
              <span
                key={i}
                className={`rounded px-2 py-0.5 text-xs tabular-nums ${
                  l.status === "valido" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                }`}
                title={l.lote}
              >
                {l.numero ? String(l.numero).padStart(4, "0") : "?"}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Banner({ r }: { r: Resultado }) {
  const estilo = {
    valido: { fundo: "bg-sky-600", titulo: "QR OK", sub: "Válido — entrada NÃO registrada", Icon: CheckCircle2 },
    ja_usado: { fundo: "bg-amber-500", titulo: "JÁ ENTROU", sub: "Este ingresso já passou pela portaria", Icon: AlertTriangle },
    cancelado: { fundo: "bg-red-600", titulo: "CANCELADO", sub: "Este ingresso foi cancelado", Icon: XCircle },
    nao_pago: { fundo: "bg-red-600", titulo: "NÃO PAGO", sub: "Pedido sem pagamento confirmado", Icon: XCircle },
    outro_evento: { fundo: "bg-red-600", titulo: "OUTRO EVENTO", sub: "Este QR é de outro evento", Icon: XCircle },
    invalido: { fundo: "bg-red-600", titulo: "QR NÃO ENCONTRADO", sub: "Este código não é de nenhum ingresso", Icon: XCircle },
    erro: { fundo: "bg-red-600", titulo: "ERRO", sub: "Tente ler de novo", Icon: XCircle },
  }[r.status];
  const Icon = estilo.Icon;
  return (
    <div className={`flex items-center gap-4 rounded-2xl px-4 py-4 text-white shadow-2xl ${estilo.fundo}`}>
      <Icon className="h-12 w-12 shrink-0" strokeWidth={2.5} />
      <div className="min-w-0">
        <div className="font-display text-2xl font-extrabold leading-none">{estilo.titulo}</div>
        {(r.numero || r.lote) && (
          <div className="mt-1 text-lg font-semibold tabular-nums">
            {numeroTxt(r.numero)}{r.lote ? ` · ${r.lote}` : ""}
          </div>
        )}
        <div className="text-sm opacity-90">{estilo.sub}</div>
        {r.checked_in_at && (
          <div className="text-xs opacity-80">Entrada em {new Date(r.checked_in_at).toLocaleString("pt-BR")}</div>
        )}
        {!!r.testes_anteriores && (
          <div className="text-xs opacity-80">Já conferido {r.testes_anteriores} vez(es) antes</div>
        )}
        {r.status === "erro" && r.message && <div className="text-xs opacity-80">{r.message}</div>}
        {r.lido_em && <div className="text-xs opacity-75">Lido às {r.lido_em}</div>}
      </div>
    </div>
  );
}
