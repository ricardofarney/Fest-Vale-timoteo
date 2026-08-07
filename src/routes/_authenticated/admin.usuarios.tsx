import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePapeis } from "@/hooks/use-papeis";
import { useEventoAdmin } from "@/hooks/use-evento-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/format";
import { Crown, FlaskConical, Loader2, ShieldAlert, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: Usuarios,
});

type Usuario = {
  id: string;
  email: string;
  nome: string | null;
  criado_em: string;
  ultimo_acesso: string | null;
  demo: boolean;
  papeis: string[];
  cargos: string[];
};

/** Como cada papel/cargo aparece na tela. */
const ROTULOS: Record<string, string> = {
  master: "Master",
  organizer: "Organizador",
  organizador: "Organizador",
  caixa: "Caixa",
  portaria: "Portaria",
  staff: "Equipe",
  attendee: "Comprador",
};

function Usuarios() {
  const { master, loading: carregandoPapeis } = usePapeis();
  const { evento } = useEventoAdmin();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-usuarios"],
    enabled: master,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_usuarios");
      if (error) throw error;
      return data as unknown as Usuario[];
    },
  });

  if (carregandoPapeis) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Só o master vê a lista completa de contas
  if (!master) {
    return (
      <Card className="p-10 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground/60" />
        <h2 className="mt-4 font-display text-lg font-semibold">Lista restrita ao dono do sistema</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Você pode gerenciar a equipe do evento — criar acessos de caixa, portaria e organizador —
          na tela de equipe.
        </p>
        {evento && (
          <Button className="mt-6" asChild>
            <Link to="/organizador/eventos/$id/equipe" params={{ id: evento.id }}>
              <UserPlus className="mr-1.5 h-4 w-4" />Equipe do evento
            </Link>
          </Button>
        )}
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-10 text-center text-sm text-destructive">
        Não consegui carregar os usuários: {(error as Error).message}
      </Card>
    );
  }

  const reais = data?.filter((u) => !u.demo) ?? [];
  const demo = data?.filter((u) => u.demo) ?? [];

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="font-display text-xl font-bold">
            {reais.length} {reais.length === 1 ? "conta real" : "contas reais"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {demo.length > 0
              ? `Mais ${demo.length} contas fictícias de demonstração, listadas no fim.`
              : "Nenhuma conta de demonstração no sistema."}
          </p>
        </div>
        {evento && (
          <Button size="sm" asChild>
            <Link to="/organizador/eventos/$id/equipe" params={{ id: evento.id }}>
              <UserPlus className="mr-1.5 h-4 w-4" />Criar acesso
            </Link>
          </Button>
        )}
      </Card>

      <Lista titulo="Contas do sistema" usuarios={reais} />

      {demo.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <FlaskConical className="h-4 w-4 text-primary" />
            Contas fictícias — não têm senha, ninguém consegue entrar com elas
          </div>
          <Lista titulo="" usuarios={demo} compacto />
        </div>
      )}
    </div>
  );
}

function Lista({
  titulo,
  usuarios,
  compacto,
}: {
  titulo: string;
  usuarios: Usuario[];
  compacto?: boolean;
}) {
  if (!usuarios.length) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Nenhuma conta aqui.</Card>;
  }

  return (
    <div className="space-y-2">
      {titulo && <h3 className="font-display text-lg font-semibold">{titulo}</h3>}
      {usuarios.map((u) => {
        const ehMaster = u.papeis.includes("master");
        const marcas = [...new Set([...u.papeis, ...u.cargos])]
          .filter((p) => p !== "attendee" || u.papeis.length === 1)
          .map((p) => ROTULOS[p] ?? p);

        return (
          <Card key={u.id} className={`p-4 ${compacto ? "opacity-70" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {ehMaster && <Crown className="h-4 w-4 shrink-0 text-primary" />}
                  <span className="font-semibold">{u.nome ?? "Sem nome"}</span>
                  {[...new Set(marcas)].map((m) => (
                    <span
                      key={m}
                      className={`rounded px-2 py-0.5 text-xs ${
                        m === "Master"
                          ? "bg-primary/20 text-primary"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {m}
                    </span>
                  ))}
                </div>
                <div className="mt-0.5 truncate text-sm text-muted-foreground">{u.email}</div>
              </div>

              {!compacto && (
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  <div>criada em {fmtDateTime(u.criado_em)}</div>
                  <div className="mt-0.5">
                    {u.ultimo_acesso ? `último acesso ${fmtDateTime(u.ultimo_acesso)}` : "nunca entrou"}
                  </div>
                </div>
              )}
            </div>

            {ehMaster && !compacto && (
              <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                Esta conta é protegida no banco: ninguém consegue rebaixar nem remover, nem com a
                chave de serviço.
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
