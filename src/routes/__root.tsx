import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { SiteHeader } from "@/components/site-header";
import { FEST, absUrl } from "@/lib/fest";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi removida.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Voltar para início
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Tentar novamente
          </button>
          <a href="/" className="rounded-md border border-input px-4 py-2 text-sm">Início</a>
        </div>
      </div>
    </div>
  );
}

const FEST_TITLE = `${FEST.nome} ${FEST.cidade} ${FEST.edicaoLabel} — ${FEST.dataLabel}`;
const FEST_DESC = `${FEST.edicaoLabel} do ${FEST.nome} ${FEST.cidade}, dia ${FEST.dataLabel}, com a banda Gertrudes. Realização da ${FEST.realizador.nome}. Ingressos digitais no site oficial.`;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: FEST_TITLE },
      { name: "description", content: FEST_DESC },
      { name: "theme-color", content: "#131313" },
      { property: "og:title", content: FEST_TITLE },
      { property: "og:description", content: FEST_DESC },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:site_name", content: `${FEST.nome} ${FEST.cidade}` },
      { property: "og:url", content: FEST.urlBase },
      // A prévia de link (WhatsApp, Facebook, Instagram) só aceita URL absoluta.
      { property: "og:image", content: absUrl(FEST.imagens.ogImage) },
      { property: "og:image:secure_url", content: absUrl(FEST.imagens.ogImage) },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: String(FEST.imagens.ogImageLargura) },
      { property: "og:image:height", content: String(FEST.imagens.ogImageAltura) },
      { property: "og:image:alt", content: FEST.imagens.ogImageAlt },
      { name: "twitter:title", content: FEST_TITLE },
      { name: "twitter:description", content: FEST_DESC },
      { name: "twitter:image", content: absUrl(FEST.imagens.ogImage) },
      { name: "twitter:image:alt", content: FEST.imagens.ogImageAlt },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: FEST.urlBase },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: FEST.imagens.logo || "/favicon.ico" },
      { rel: "apple-touch-icon", href: FEST.imagens.logo || "/favicon.ico" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthSync() {
  const queryClient = useQueryClient();
  const router = useRouter();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      <div className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
