import { Link, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { usePapeis } from "@/hooks/use-papeis";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FEST } from "@/lib/fest";
import { Ticket, LayoutDashboard, ScanLine, LogOut, ShoppingCart } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ancoras = [
  { href: "#atracoes", label: "Atrações" },
  { href: "#ingressos", label: "Ingressos" },
  { href: "#sobre", label: "O evento" },
  { href: "#edicoes", label: "Edições anteriores" },
  { href: "#local", label: "Local" },
];

/** Páginas próprias que ficam no menu em qualquer tela, não só na home. */
const paginas = [{ to: "/patrocinadores", label: "Patrocinadores" }] as const;

export function SiteHeader() {
  const { user } = useAuth();
  const { organizador, podeValidar, podeUsarPdv } = usePapeis();
  const naHome = useRouterState({ select: (s) => s.location.pathname === "/" });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          {FEST.imagens.logo ? (
            <img src={FEST.imagens.logo} alt="" className="h-10 w-10" width={80} height={80} />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary">
              <Ticket className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
          <span className="font-display text-lg font-bold leading-none tracking-tight">
            {FEST.nome} <span className="text-primary">{FEST.cidade}</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {naHome &&
            ancoras.map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {a.label}
              </a>
            ))}
          {paginas.map((p) => (
            <Link
              key={p.to}
              to={p.to}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground [&.active]:text-foreground"
            >
              {p.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {naHome && (
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <a href="#ingressos">
                <Ticket className="mr-1.5 h-4 w-4" />
                Ingressos
              </a>
            </Button>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                    {user.email?.[0]?.toUpperCase()}
                  </div>
                  <span className="hidden max-w-[140px] truncate sm:inline">{user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to="/meus-ingressos"><Ticket className="mr-2 h-4 w-4" />Meus ingressos</Link>
                </DropdownMenuItem>
                {organizador && (
                  <DropdownMenuItem asChild>
                    <Link to="/organizador"><LayoutDashboard className="mr-2 h-4 w-4" />Painel do organizador</Link>
                  </DropdownMenuItem>
                )}
                {podeValidar && (
                  <DropdownMenuItem asChild>
                    <Link to="/validacao"><ScanLine className="mr-2 h-4 w-4" />Validação na entrada</Link>
                  </DropdownMenuItem>
                )}
                {podeUsarPdv && (
                  <DropdownMenuItem asChild>
                    <Link to="/pdv"><ShoppingCart className="mr-2 h-4 w-4" />PDV do evento</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Entrar</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
