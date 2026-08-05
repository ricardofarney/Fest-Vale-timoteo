import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { LayoutDashboard, CalendarPlus, ListChecks } from "lucide-react";

export const Route = createFileRoute("/_authenticated/organizador")({
  head: () => ({ meta: [{ title: "Painel do organizador — Fest Vale Timóteo" }] }),
  component: OrganizerLayout,
});

function OrganizerLayout() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Painel do organizador</h1>
          <p className="text-sm text-muted-foreground">Gerencie eventos, ingressos, lotes e cupons.</p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link to="/organizador" activeOptions={{ exact: true }} activeProps={{ className: "bg-primary text-primary-foreground" }} className="inline-flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 hover:bg-secondary">
            <ListChecks className="h-4 w-4" />Meus eventos
          </Link>
          <Link to="/organizador/eventos/novo" activeProps={{ className: "bg-primary text-primary-foreground" }} className="inline-flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 hover:bg-secondary">
            <CalendarPlus className="h-4 w-4" />Novo evento
          </Link>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
