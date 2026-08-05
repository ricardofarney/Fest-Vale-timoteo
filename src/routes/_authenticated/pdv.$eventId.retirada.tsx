import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
};

function Retirada() {
  const containerId = "leitor-retirada";
  const scannerRef = useRef<{ stop: () => Promise<void>; clear?: () => void } | null>(null);
  const ultimoRef = useRef<{ token: string; at: number }>({ token: "", at: 0 });

  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [manual, setManual] = useState("");

  const parar = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* já parado */ }
      try { scannerRef.current.clear?.(); } catch { /* ignora */ }
      scannerRef.current = null;
    }
    setRodando(false);
  };

  useEffect(() => () => { parar(); }, []);

  const consultar = async (token: string) => {
    const agora = Date.now();
    if (token === ultimoRef.current.token && agora - ultimoRef.current.at < 2500) return;
    ultimoRef.current = { token, at: agora };

    const { data, error } = await supabase.rpc("pos_retirar", { _ticket_token: token });
    if (error) return toast.error(error.message);
    setResultado(data as unknown as Resultado);
  };

  const iniciar = async () => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const leitor = new Html5Qrcode(containerId);
      scannerRef.current = leitor as unknown as { stop: () => Promise<void>; clear?: () => void };
      await leitor.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (texto: string) => consultar(texto),
        () => undefined,
      );
      setRodando(true);
    } catch (e) {
      console.error(e);
      toast.error("Não consegui abrir a câmera. Confira a permissão do navegador.");
    }
  };

  const cor =
    resultado?.status === "ok" ? "border-success/60 bg-success/10"
    : resultado?.status === "duplicado" ? "border-primary/60 bg-primary/10"
    : "border-destructive/60 bg-destructive/10";

  return (
    <div className="container mx-auto max-w-md px-4 py-6">
      <Link to="/pdv" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" />PDV
      </Link>

      <h1 className="font-display text-2xl font-bold">Balcão de retirada</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Leia o QR do ticket para liberar a entrega. Cada ticket vale uma retirada.
      </p>

      <div className="mt-5 overflow-hidden rounded-2xl border border-border/60 bg-black">
        <div id={containerId} className="min-h-[240px] w-full" />
      </div>

      <Button className="mt-3 w-full" size="lg" onClick={rodando ? parar : iniciar}>
        <Camera className="mr-2 h-5 w-5" />
        {rodando ? "Parar câmera" : "Abrir câmera"}
      </Button>

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Keyboard className="h-3.5 w-3.5" />
          Ou digite o código impresso no ticket
        </div>
        <div className="flex gap-2">
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value.trim())}
            placeholder="ex.: a1b2c3d4e5f60718"
            className="font-mono"
          />
          <Button variant="outline" onClick={() => manual && consultar(manual)}>Conferir</Button>
        </div>
      </div>

      {resultado && (
        <Card className={`mt-5 border-2 p-5 ${cor}`}>
          <div className="flex items-center gap-3">
            {resultado.status === "ok" && <CheckCircle2 className="h-8 w-8 shrink-0 text-success" />}
            {resultado.status === "duplicado" && <AlertTriangle className="h-8 w-8 shrink-0 text-primary" />}
            {(resultado.status === "invalido" || resultado.status === "cancelada") && (
              <XCircle className="h-8 w-8 shrink-0 text-destructive" />
            )}
            <div>
              <div className="font-display text-xl font-bold">{resultado.message}</div>
              {resultado.retirado_em && (
                <div className="text-sm text-muted-foreground">
                  Retirado às {new Date(resultado.retirado_em).toLocaleTimeString("pt-BR")}
                </div>
              )}
            </div>
          </div>

          {resultado.cortesia && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-xs font-medium text-primary">
              <Gift className="h-3.5 w-3.5" />Cortesia
            </div>
          )}

          {resultado.itens && resultado.itens.length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t border-border/40 pt-3">
              {resultado.itens.map((i, n) => (
                <li key={n} className="flex items-baseline gap-2 text-lg">
                  <span className="font-display font-bold">{i.qtd}×</span>
                  <span>{i.nome}</span>
                </li>
              ))}
            </ul>
          )}

          <Button variant="ghost" className="mt-4 w-full" onClick={() => setResultado(null)}>
            Próximo
          </Button>
        </Card>
      )}
    </div>
  );
}
