import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Wifi, WifiOff, RefreshCw, Camera } from "lucide-react";
import { deviceId, enqueueScan, listPending, deleteScan } from "@/lib/scan-queue";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/validacao/$eventId/scanner")({
  head: () => ({ meta: [{ title: "Scanner — Fest Vale Timóteo" }] }),
  component: Scanner,
});

type ScanResult = {
  status: "ok" | "duplicate" | "cancelled" | "invalid" | "queued" | "error";
  message: string;
  attendee_name?: string;
  type?: string;
  batch?: string;
  checked_in_at?: string;
};

function Scanner() {
  const { eventId } = Route.useParams();
  const containerId = "qr-reader";
  const scannerRef = useRef<any>(null);
  const lastScanRef = useRef<{ token: string; at: number }>({ token: "", at: 0 });
  const [result, setResult] = useState<ScanResult | null>(null);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pending, setPending] = useState(0);
  const [running, setRunning] = useState(false);
  const [evName, setEvName] = useState("");

  useEffect(() => {
    supabase.from("events").select("name").eq("id", eventId).single().then(({ data }) => {
      if (data) setEvName(data.name);
    });
  }, [eventId]);

  // Online status + initial pending count
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    listPending().then((p) => setPending(p.length));
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Sync queued scans whenever online
  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    (async () => {
      const items = await listPending();
      for (const it of items) {
        if (cancelled) break;
        const { error } = await supabase.rpc("validate_ticket", {
          _qr_token: it.qr_token,
          _event_id: it.event_id,
          _device_id: it.device_id,
        });
        if (!error && it.id != null) await deleteScan(it.id);
      }
      const after = await listPending();
      if (!cancelled) setPending(after.length);
    })();
    return () => { cancelled = true; };
  }, [online]);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* ignore */ }
      try { scannerRef.current.clear?.(); } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setRunning(false);
  };

  const startScanner = async () => {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const html5 = new Html5Qrcode(containerId);
      scannerRef.current = html5;
      await html5.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => handleScan(decoded),
        () => undefined,
      );
      setRunning(true);
    } catch (e: any) {
      toast.error("Não consegui acessar a câmera. Verifique a permissão.");
      console.error(e);
    }
  };

  useEffect(() => { return () => { stopScanner(); }; // eslint-disable-next-line
  }, []);

  const handleScan = async (token: string) => {
    // debounce duplicate reads within 2.5s
    const now = Date.now();
    if (token === lastScanRef.current.token && now - lastScanRef.current.at < 2500) return;
    lastScanRef.current = { token, at: now };

    if (!navigator.onLine) {
      await enqueueScan({ qr_token: token, event_id: eventId, device_id: deviceId(), scanned_at: new Date().toISOString() });
      setPending((p) => p + 1);
      setResult({ status: "queued", message: "Sem conexão — validação salva para enviar depois" });
      return;
    }
    const { data, error } = await supabase.rpc("validate_ticket", {
      _qr_token: token,
      _event_id: eventId,
      _device_id: deviceId(),
    });
    if (error) {
      setResult({ status: "error", message: error.message });
      return;
    }
    setResult(data as ScanResult);
  };

  const syncNow = async () => {
    const items = await listPending();
    for (const it of items) {
      const { error } = await supabase.rpc("validate_ticket", {
        _qr_token: it.qr_token, _event_id: it.event_id, _device_id: it.device_id,
      });
      if (!error && it.id != null) await deleteScan(it.id);
    }
    const after = await listPending();
    setPending(after.length);
    toast.success("Sincronização concluída");
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Link to="/validacao" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" />Voltar
      </Link>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Scanner</h1>
          <p className="text-sm text-muted-foreground">{evName}</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${online ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {online ? "Online" : "Offline"}
          </span>
          {pending > 0 && (
            <button onClick={syncNow} className="inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-1 text-accent">
              <RefreshCw className="h-3 w-3" />{pending} pendente{pending > 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div id={containerId} className="relative aspect-square w-full bg-black" />
        <div className="border-t border-border/60 p-3">
          {running ? (
            <Button variant="outline" className="w-full" onClick={stopScanner}>Parar câmera</Button>
          ) : (
            <Button className="w-full" onClick={startScanner}><Camera className="mr-2 h-4 w-4" />Iniciar câmera</Button>
          )}
        </div>
      </Card>

      {result && <ResultBanner result={result} />}
    </div>
  );
}

function ResultBanner({ result }: { result: ScanResult }) {
  const style = {
    ok: { bg: "bg-success/15 border-success/40", text: "text-success", Icon: CheckCircle2 },
    duplicate: { bg: "bg-accent/15 border-accent/40", text: "text-accent", Icon: AlertTriangle },
    cancelled: { bg: "bg-destructive/15 border-destructive/40", text: "text-destructive", Icon: XCircle },
    invalid: { bg: "bg-destructive/15 border-destructive/40", text: "text-destructive", Icon: XCircle },
    queued: { bg: "bg-accent/15 border-accent/40", text: "text-accent", Icon: AlertTriangle },
    error: { bg: "bg-destructive/15 border-destructive/40", text: "text-destructive", Icon: XCircle },
  }[result.status];
  const Icon = style.Icon;
  return (
    <div className={`mt-4 rounded-xl border p-5 ${style.bg}`}>
      <div className={`flex items-center gap-3 ${style.text}`}>
        <Icon className="h-7 w-7" />
        <div>
          <div className="font-display text-lg font-bold">{result.message}</div>
          {result.attendee_name && <div className="text-sm">{result.attendee_name}{result.type ? ` — ${result.type}` : ""}{result.batch ? ` / ${result.batch}` : ""}</div>}
          {result.checked_in_at && <div className="text-xs opacity-80">Entrada anterior em {new Date(result.checked_in_at).toLocaleString("pt-BR")}</div>}
        </div>
      </div>
    </div>
  );
}
