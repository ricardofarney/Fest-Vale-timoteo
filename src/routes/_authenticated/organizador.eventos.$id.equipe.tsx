import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft, UserPlus, Trash2, KeyRound, Copy, ScanLine, Loader2, ShieldCheck, Smartphone,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/organizador/eventos/$id/equipe")({
  head: () => ({ meta: [{ title: "Equipe de portaria — Fest Vale Timóteo" }] }),
  component: EquipePage,
});

type Cargo = "organizador" | "caixa" | "portaria";
type Credencial = { email: string; senha: string | null; conta_nova: boolean; cargo: Cargo };

const CARGOS: { id: Cargo; nome: string; resumo: string }[] = [
  { id: "organizador", nome: "Organizador",
    resumo: "Tudo do evento: cadastra usuários e produtos, dá entrada em estoque, autoriza cortesia e sangria, vê os relatórios." },
  { id: "caixa", nome: "Caixa",
    resumo: "Vende no PDV — produtos e ingresso na portaria — e entrega no balcão. Não vê relatório nem mexe em estoque." },
  { id: "portaria", nome: "Equipe de portaria",
    resumo: "Só lê o QR dos ingressos na entrada." },
];

const ROTULO_CARGO: Record<Cargo, string> = {
  organizador: "Organizador", caixa: "Caixa", portaria: "Portaria",
};

function EquipePage() {
  const { id: eventId } = Route.useParams();
  const qc = useQueryClient();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargo, setCargo] = useState<Cargo>("portaria");
  const [salvando, setSalvando] = useState(false);
  const [credencial, setCredencial] = useState<Credencial | null>(null);

  const { data: evento } = useQuery({
    queryKey: ["evento-equipe", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events").select("id, name, slug").eq("id", eventId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: equipe, isLoading } = useQuery({
    queryKey: ["equipe", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_staff")
        .select("id, name, email, cargo, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Copiado");
    } catch {
      toast.error("Não consegui copiar — selecione o texto manualmente.");
    }
  };

  const criar = async () => {
    if (!nome.trim()) return toast.error("Informe o nome da pessoa.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return toast.error("Informe um e-mail válido.");

    setSalvando(true);
    const { data, error } = await supabase.functions.invoke("equipe-criar", {
      body: { event_id: eventId, nome: nome.trim(), email: email.trim().toLowerCase(), cargo },
    });
    setSalvando(false);

    if (error) {
      const detalhe = (data as { error?: string } | null)?.error;
      return toast.error(detalhe || "Não consegui criar o acesso.");
    }
    const r = data as Credencial & { status: string };
    setCredencial({ email: r.email, senha: r.senha, conta_nova: r.conta_nova, cargo: r.cargo });
    setNome("");
    setEmail("");
    qc.invalidateQueries({ queryKey: ["equipe", eventId] });
    toast.success(r.conta_nova ? "Acesso criado" : "Pessoa vinculada ao evento");
  };

  const novaSenha = async (staffId: string) => {
    const { data, error } = await supabase.functions.invoke("equipe-senha", { body: { staff_id: staffId } });
    if (error) {
      const detalhe = (data as { error?: string } | null)?.error;
      return toast.error(detalhe || "Não consegui gerar a senha.");
    }
    const r = data as { email: string; senha: string };
    setCredencial({ email: r.email, senha: r.senha, conta_nova: false, cargo: "portaria" });
    toast.success("Senha nova gerada");
  };

  const remover = async (staffId: string, nomePessoa: string | null) => {
    const { error } = await supabase.from("event_staff").delete().eq("id", staffId);
    if (error) return toast.error("Não consegui remover o acesso.");
    qc.invalidateQueries({ queryKey: ["equipe", eventId] });
    toast.success(`${nomePessoa ?? "Acesso"} não valida mais neste evento`);
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <Link to="/organizador" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" />Voltar ao painel
      </Link>

      <h1 className="font-display text-3xl font-bold">Equipe do evento</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {evento?.name ?? "Evento"} — cada pessoa entra pelo próprio celular e enxerga apenas o que o
        cargo dela permite.
      </p>

      {/* --------------------------------------------- Credencial gerada */}
      {credencial && (
        <Card className="mt-6 border-primary/50 bg-primary/5 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {credencial.senha ? "Anote agora — a senha não aparece de novo" : "Pessoa vinculada ao evento"}
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">E-mail</div>
                <div className="truncate font-mono text-sm">{credencial.email}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copiar(credencial.email)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            {credencial.senha ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Senha</div>
                  <div className="truncate font-mono text-lg font-semibold tracking-wide">{credencial.senha}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => copiar(credencial.senha!)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Esse e-mail já tinha conta no site. A senha continua sendo a que a pessoa já usa —
                se ela não lembrar, use "Nova senha" na lista abaixo.
              </p>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                copiar(
                  `Acesso ao ${evento?.name ?? "evento"} — ${ROTULO_CARGO[credencial.cargo]}\n` +
                  `Site: ${typeof window !== "undefined" ? window.location.origin : ""}/login\n` +
                  `E-mail: ${credencial.email}\n` +
                  (credencial.senha ? `Senha: ${credencial.senha}\n` : "") +
                  (credencial.cargo === "portaria"
                    ? `Depois de entrar, abra o menu e toque em "Validação na entrada".`
                    : `Depois de entrar, abra o menu e toque em "PDV do evento".`),
                )
              }
            >
              <Copy className="mr-2 h-4 w-4" />Copiar instruções para mandar no WhatsApp
            </Button>

            <Button variant="ghost" size="sm" className="w-full" onClick={() => setCredencial(null)}>
              Já anotei, fechar
            </Button>
          </div>
        </Card>
      )}

      {/* -------------------------------------------------- Novo acesso */}
      <Card className="mt-6 p-6">
        <h2 className="font-display text-lg font-semibold">Novo acesso</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          O sistema gera uma senha curta na hora. Você entrega para a pessoa como preferir.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="eq-nome">Nome</Label>
            <Input id="eq-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da pessoa" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eq-email">E-mail</Label>
            <Input
              id="eq-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usado como login"
            />
          </div>
        </div>
        <div className="mt-4">
          <Label className="mb-2 block">Nível de acesso</Label>
          <div className="grid gap-2">
            {CARGOS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCargo(c.id)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  cargo === c.id
                    ? "border-primary bg-primary/10"
                    : "border-border/70 hover:bg-secondary/40"
                }`}
              >
                <div className="font-semibold">{c.nome}</div>
                <div className="mt-0.5 text-sm text-muted-foreground">{c.resumo}</div>
              </button>
            ))}
          </div>
        </div>

        <Button className="mt-4" onClick={criar} disabled={salvando}>
          {salvando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</> : <><UserPlus className="mr-2 h-4 w-4" />Criar acesso</>}
        </Button>
      </Card>

      {/* ------------------------------------------------------- A lista */}
      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold">
          Na equipe {equipe?.length ? <span className="text-muted-foreground">({equipe.length})</span> : null}
        </h2>

        <div className="mt-3 space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

          {equipe?.length === 0 && (
            <Card className="p-10 text-center">
              <Smartphone className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                Ninguém cadastrado ainda. Crie um acesso para cada pessoa que vai ficar na entrada.
              </p>
            </Card>
          )}

          {equipe?.map((m) => (
            <Card key={m.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold">{m.name}</span>
                  <span className="shrink-0 rounded-full border border-border/70 bg-secondary/50 px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {ROTULO_CARGO[(m.cargo ?? "portaria") as Cargo]}
                  </span>
                </div>
                <div className="truncate text-sm text-muted-foreground">{m.email}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" onClick={() => novaSenha(m.id)}>
                  <KeyRound className="mr-1 h-4 w-4" />Nova senha
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remover(m.id, m.name)}>
                  <Trash2 className="mr-1 h-4 w-4" />Remover
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Card className="mt-8 bg-secondary/30 p-6">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold">
          <ScanLine className="h-4 w-4 text-primary" />Como funciona no dia
        </h3>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>1. A pessoa entra no site pelo celular com o e-mail e a senha que você entregou.</li>
          <li>2. No menu da conta, a <span className="text-foreground">portaria</span> toca em "Validação na entrada"; o <span className="text-foreground">caixa</span> toca em "PDV do evento".</li>
          <li>3. Na primeira leitura, o navegador pede permissão para usar a câmera — é só autorizar uma vez.</li>
          <li>4. Ao ler o QR, a tela responde em verde (liberado), amarelo (já usado) ou vermelho (inválido).</li>
          <li>5. Se a internet cair, as leituras da portaria ficam salvas no aparelho e sobem sozinhas quando a conexão voltar.</li>
        </ol>
      </Card>
    </div>
  );
}
