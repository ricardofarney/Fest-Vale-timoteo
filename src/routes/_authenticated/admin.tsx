import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { usePapeis } from "@/hooks/use-papeis";
import { Card } from "@/components/ui/card";
import {
  Gauge,
  MessageCircle,
  Plug,
  Users,
  ShieldAlert,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administração — Fest Vale Timóteo" }] }),
  component: AdminLayout,
});

const abas = [
  { to: "/admin", label: "Visão geral", icone: Gauge, exato: true },
  { to: "/admin/whatsapp", label: "WhatsApp", icone: MessageCircle, exato: false },
  { to: "/admin/integracoes", label: "Integrações", icone: Plug, exato: false },
  { to: "/admin/usuarios", label: "Usuários", icone: Users, exato: false },
] as const;

function AdminLayout() {
  const { master, organizador, loading } = usePapeis();
  const navigate = useNavigate();

  // Caixa e portaria não entram aqui de jeito nenhum
  useEffect(() => {
    if (!loading && !organizador) navigate({ to: "/", replace: true });
  }, [loading, organizador, navigate]);

  if (loading) {
    return (
      <div className="container mx-auto flex justify-center px-4 py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!organizador) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-24">
        <Card className="p-10 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <h1 className="mt-4 font-display text-xl font-bold">Área restrita</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta parte do sistema é só para a organização.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Administração</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {master
            ? "Você é o dono do sistema: vê e configura tudo."
            : "Painel da organização do evento."}
        </p>
      </div>

      {/* rolagem lateral no celular, para nenhuma aba sumir */}
      <nav className="-mx-4 mb-8 overflow-x-auto px-4">
        <div className="flex w-max gap-2 text-sm">
          {abas.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              activeOptions={{ exact: a.exato }}
              activeProps={{ className: "bg-primary text-primary-foreground border-primary" }}
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-border/60 px-3 py-2 transition-colors hover:bg-secondary"
            >
              <a.icone className="h-4 w-4" />
              {a.label}
            </Link>
          ))}
        </div>
      </nav>

      <Outlet />
    </div>
  );
}
