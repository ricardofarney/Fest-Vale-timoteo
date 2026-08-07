import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FEST, mapsUrl, NIVEIS_PATROCINIO, NIVEL_INFO } from "@/lib/fest";
import { brl } from "@/lib/format";
import {
  ArrowRight,
  CalendarDays,
  Check,
  HeartHandshake,
  MapPin,
  Handshake,
  Globe,
  Instagram,
  Music4,
  Newspaper,
  QrCode,
  Youtube,
  ShieldCheck,
  Ticket,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${FEST.nome} ${FEST.cidade} ${FEST.edicaoLabel} — ${FEST.dataLabel}` },
      {
        name: "description",
        content: `${FEST.edicaoLabel} do ${FEST.nome} ${FEST.cidade}, dia ${FEST.dataLabel}, com a banda Gertrudes. Realização da ${FEST.realizador.nome}. Ingressos no site oficial.`,
      },
    ],
  }),
  component: HomePage,
});

/** Busca o evento oficial no banco. Enquanto ele não existir, o site usa o conteúdo fixo. */
async function fetchFestEvent() {
  const { data: ev } = await supabase
    .from("events")
    .select("id, slug, name, starts_at, venue, address, cover_url, description")
    .eq("slug", FEST.slug)
    .eq("status", "published")
    .maybeSingle();
  if (!ev) return null;

  const { data: types } = await supabase
    .from("ticket_types")
    .select("id, name, sort_order, ticket_batches(id, name, price_cents, quantity_total, quantity_sold, sort_order, ends_at)")
    .eq("event_id", ev.id)
    .order("sort_order");

  return { ev, types: types ?? [] };
}

function HomePage() {
  const { data } = useQuery({ queryKey: ["fest-event"], queryFn: fetchFestEvent });

  return (
    <div>
      <Hero />
      <Atracoes />
      <Ingressos data={data} />
      <Sobre />
      <EdicoesAnteriores />
      <Patrocinadores />
      <LocalEData />
      <Faq />
      <Footer />
    </div>
  );
}

/* ---------------------------------------------------------------- Hero */

function useCountdown(targetISO: string) {
  const [left, setLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    const target = new Date(targetISO).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) return setLeft({ d: 0, h: 0, m: 0, s: 0 });
      setLeft({
        d: Math.floor(diff / 86_400_000),
        h: Math.floor((diff / 3_600_000) % 24),
        m: Math.floor((diff / 60_000) % 60),
        s: Math.floor((diff / 1000) % 60),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetISO]);

  return left;
}

/**
 * Assinatura do patrocinador master, ao lado da logo do festival.
 * Fica à direita, separada por um fio, com a palavra "apresenta" em cima —
 * é o bloco que dá o destaque da cota master sem competir com a marca do evento.
 * No celular desce para baixo da logo, porque as duas lado a lado não cabem.
 */
function Apresenta() {
  const a = FEST.apresenta;
  if (!a.nome) return null;

  const marca = a.logo ? (
    <img
      src={a.logo}
      alt={a.nome}
      className="h-28 w-auto object-contain md:h-36"
      width={190}
      height={200}
    />
  ) : (
    <span className="font-display text-3xl font-bold md:text-4xl">{a.nome}</span>
  );

  return (
    <div className="flex shrink-0 flex-col items-center gap-3">
      {a.site ? (
        <a
          href={a.site}
          target="_blank"
          rel="noreferrer"
          className="transition-opacity hover:opacity-80"
          aria-label={`${a.nome} ${a.verbo} o ${FEST.edicao}º ${FEST.nome} ${FEST.cidade}`}
        >
          {marca}
        </a>
      ) : (
        marca
      )}
      <span className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground md:text-xs">
        {a.verbo}
      </span>
    </div>
  );
}

function Hero() {
  const left = useCountdown(FEST.dataISO);

  return (
    <section className="bg-glow relative isolate overflow-hidden border-b border-border/60">
      {FEST.imagens.hero && (
        <>
          <img src={FEST.imagens.hero} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </>
      )}

      <div className="container mx-auto px-4 py-20 md:py-28">
        <div className="mx-auto max-w-4xl text-center">
          {/* Netvale à esquerda, logo do festival à direita: a frase
              "Netvale apresenta o Fest Vale" se lê na ordem natural. */}
          <div className="mb-8 flex flex-col items-center justify-center gap-6 md:flex-row md:gap-10">
            <Apresenta />

            {/* fio de separação: horizontal no celular, vertical no computador */}
            {FEST.apresenta.nome && (
              <div className="h-px w-20 shrink-0 bg-border/70 md:h-32 md:w-px" aria-hidden="true" />
            )}

            {FEST.imagens.logo ? (
              <img
                src={FEST.imagens.logo}
                alt={`${FEST.nome} ${FEST.cidade} — ${FEST.edicaoLabel}`}
                className="h-44 w-44 shrink-0 drop-shadow-2xl md:h-64 md:w-64"
                width={512}
                height={512}
              />
            ) : (
              <h1 className="font-display text-5xl font-bold leading-[0.95] md:text-8xl">
                {FEST.nome}
                <span className="block text-primary">{FEST.cidade}</span>
              </h1>
            )}
          </div>

          <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">
            {FEST.nome} <span className="text-primary">{FEST.cidade}</span>
          </h1>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-lg text-muted-foreground md:text-xl">
            <span className="font-medium text-foreground">{FEST.dataLabel}</span>
            <span className="text-border">|</span>
            <span>{FEST.cidade}/{FEST.estado}</span>
            <span className="text-border">|</span>
            <span>
              com a banda <span className="font-semibold text-foreground">Gertrudes</span>
            </span>
          </div>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <a href="#ingressos">
                <Ticket className="mr-2 h-4 w-4" />
                Garantir meu ingresso
              </a>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto" asChild>
              <a href="#atracoes">Ver atrações</a>
            </Button>
          </div>

          {left && (
            <div className="mx-auto mt-14 grid max-w-lg grid-cols-4 gap-2 sm:gap-3">
              {[
                { v: left.d, l: left.d === 1 ? "dia" : "dias" },
                { v: left.h, l: "horas" },
                { v: left.m, l: "min" },
                { v: left.s, l: "seg" },
              ].map((b) => (
                <div key={b.l} className="rounded-xl border border-border/60 bg-card/50 px-2 py-4 backdrop-blur">
                  <div className="font-display text-2xl font-bold tabular-nums sm:text-4xl">
                    {String(b.v).padStart(2, "0")}
                  </div>
                  <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">{b.l}</div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-8 text-sm text-muted-foreground">
            Realização{" "}
            <span className="font-medium text-foreground">{FEST.realizador.nome}</span>
          </p>
        </div>

        {FEST.imagens.heroBanda && (
          <div className="relative mx-auto mt-12 max-w-3xl md:mt-16">
            <img
              src={FEST.imagens.heroBanda}
              alt={FEST.imagens.heroBandaLegenda}
              className="mx-auto w-full drop-shadow-[0_25px_45px_rgba(0,0,0,0.55)]"
              width={1400}
              height={933}
            />
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Atrações */

function Atracoes() {
  return (
    <section id="atracoes" className="container mx-auto scroll-mt-20 px-4 py-20">
      <SectionHead
        eyebrow="Line-up"
        title="Quem sobe ao palco"
        subtitle="A programação completa da 4ª edição vai sendo anunciada até a data do evento."
      />

      <div className="mt-10 space-y-5">
        {FEST.atracoes
          .filter((a) => a.destaque)
          .map((a) => (
            <article
              key={a.nome}
              className="overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 to-card"
            >
              <div className="md:grid md:grid-cols-2 md:items-stretch">
                <div className="relative h-64 overflow-hidden sm:h-80 md:h-full md:min-h-[420px]">
                  {a.imagem ? (
                    <img
                      src={a.imagem}
                      alt={`Banda ${a.nome}`}
                      className="h-full w-full object-contain object-bottom p-4 md:p-6"
                      loading="lazy"
                    />
                  ) : (
                    <div className="bg-glow grid h-full w-full place-items-center bg-secondary/40">
                      <Music4 className="h-16 w-16 text-primary/40" />
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-center p-8 md:p-10">
                  <div className="text-xs font-medium uppercase tracking-wider text-primary">{a.papel}</div>
                  <h3 className="mt-2 font-display text-4xl font-bold md:text-5xl">{a.nome}</h3>

                  {a.tags && a.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {a.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-xs text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="mt-5 leading-relaxed text-muted-foreground">{a.descricao}</p>

                  {a.bio?.map((p) => (
                    <p key={p.slice(0, 24)} className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {p}
                    </p>
                  ))}

                  {a.integrantes && a.integrantes.length > 0 && (
                    <div className="mt-6">
                      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Integrantes
                      </div>
                      <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                        {a.integrantes.map((m) => (
                          <li key={m} className="flex items-start gap-2">
                            <Music4 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                            <span>{m}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {a.redes && a.redes.length > 0 && (
                    <div className="mt-6 flex flex-wrap gap-3">
                      {a.redes.map((r) => (
                        <Button key={r.url} variant="outline" size="sm" asChild>
                          <a href={r.url} target="_blank" rel="noopener noreferrer">
                            {r.tipo === "instagram" && <Instagram className="mr-2 h-4 w-4" />}
                            {r.tipo === "youtube" && <Youtube className="mr-2 h-4 w-4" />}
                            {r.tipo === "spotify" && <Music4 className="mr-2 h-4 w-4" />}
                            {r.tipo === "site" && <Globe className="mr-2 h-4 w-4" />}
                            {r.label}
                          </a>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {a.videoId && (
                <div className="border-t border-border/60 p-6 md:p-10 md:pt-8">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Ouça a banda
                  </div>
                  <div className="mt-3 aspect-video w-full max-w-2xl overflow-hidden rounded-xl border border-border/60 bg-black">
                    <iframe
                      className="h-full w-full"
                      src={`https://www.youtube-nocookie.com/embed/${a.videoId}`}
                      title={`Vídeo da banda ${a.nome}`}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                </div>
              )}
            </article>
          ))}

        <div className="grid gap-5 sm:grid-cols-2">
          {FEST.atracoes
            .filter((a) => !a.destaque)
            .map((a, i) => (
              <article
                key={`${a.nome}-${i}`}
                className="overflow-hidden rounded-2xl border border-dashed border-border/70 bg-card/40 p-8 text-center"
              >
                <Music4 className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <div className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {a.papel}
                </div>
                <h3 className="mt-1 font-display text-xl font-semibold">{a.nome}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{a.descricao}</p>
              </article>
            ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- Ingressos */

function Ingressos({ data }: { data: Awaited<ReturnType<typeof fetchFestEvent>> | undefined }) {
  const temEvento = !!data?.ev;

  const lotes = temEvento
    ? (data!.types as any[]).flatMap((t) =>
        [...(t.ticket_batches ?? [])]
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((b: any) => ({
            tipo: t.name as string,
            lote: b.name as string,
            precoCents: b.price_cents as number,
            disponivel: b.quantity_total === 0 || b.quantity_sold < b.quantity_total,
            restantes: Math.max((b.quantity_total ?? 0) - (b.quantity_sold ?? 0), 0),
            total: b.quantity_total as number,
          })),
      )
    : FEST.lotesExemplo.map((l) => ({ ...l, restantes: 0, total: 0 }));

  return (
    <section id="ingressos" className="scroll-mt-20 border-y border-border/60 bg-card/30">
      <div className="container mx-auto px-4 py-20">
        <SectionHead
          eyebrow="Ingressos"
          title="Garanta o seu"
          subtitle="Ingresso digital com QR Code, direto no seu celular. Lotes viram automaticamente quando esgotam."
        />

        <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
          {lotes.map((l, i) => (
            <div
              key={`${l.tipo}-${l.lote}-${i}`}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                l.disponivel ? "border-border/60 bg-card" : "border-border/40 bg-card/40 opacity-60"
              }`}
            >
              <div className="text-sm font-medium text-muted-foreground">{l.tipo}</div>
              <div className="mt-1 font-display text-lg font-semibold">{l.lote}</div>
              <div className="mt-5 font-display text-3xl font-bold tabular-nums">{brl(l.precoCents)}</div>
              {l.disponivel ? (
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-success">
                  <Check className="h-3.5 w-3.5" />
                  Disponível
                  {l.total > 0 && l.restantes <= 20 && <span>· últimas {l.restantes} unidades</span>}
                </div>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">Esgotado</div>
              )}
            </div>
          ))}
        </div>

        <div className="mx-auto mt-8 flex max-w-4xl flex-col items-center gap-3">
          {temEvento ? (
            <Button size="lg" asChild>
              <Link to="/eventos/$slug" params={{ slug: FEST.slug }}>
                Comprar ingresso
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button size="lg" disabled>
                Vendas em breve
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Os valores acima são ilustrativos. Assim que o evento for publicado no painel, os lotes reais
                aparecem aqui automaticamente.
              </p>
            </>
          )}
        </div>

        <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            { icon: QrCode, t: "Ingresso digital", d: "QR Code no celular, sem fila de retirada" },
            { icon: ShieldCheck, t: "Compra segura", d: "Site oficial do evento, sem intermediário" },
            { icon: HeartHandshake, t: "Renda revertida", d: "Ações sociais da Loja Acácia" },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="rounded-xl border border-border/60 bg-background/40 p-4">
              <Icon className="mb-2 h-5 w-5 text-primary" />
              <div className="font-semibold">{t}</div>
              <div className="text-sm text-muted-foreground">{d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Sobre */

function Sobre() {
  return (
    <section id="sobre" className="container mx-auto scroll-mt-20 px-4 py-20">
      <div className="grid gap-12 md:grid-cols-2 md:items-center">
        <div>
          <SectionHead eyebrow="O evento" title={FEST.sobre.titulo} align="left" />
          <div className="mt-6 space-y-4 text-muted-foreground">
            {FEST.sobre.paragrafos.map((p) => (
              <p key={p.slice(0, 24)} className="leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { n: `${FEST.edicao}ª`, l: "edição do festival", c: "var(--chart-1)" },
            { n: "2027", l: "ano da próxima festa", c: "var(--chart-2)" },
            { n: "Timóteo", l: "cidade que recebe a festa", c: "var(--chart-3)" },
            { n: "Vale do Aço", l: "região atendida pelas ações", c: "var(--chart-4)" },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl border border-border/60 bg-card/50 p-6">
              <div className="font-display text-3xl font-bold" style={{ color: s.c }}>
                {s.n}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------- Edições anteriores */

function EdicoesAnteriores() {
  return (
    <section id="edicoes" className="scroll-mt-20 border-y border-border/60 bg-card/30">
      <div className="container mx-auto px-4 py-20">
        <SectionHead
          eyebrow="De onde viemos"
          title="As edições anteriores"
          subtitle="Três festas, uma mesma finalidade: sustentar as ações sociais da loja no Vale do Aço."
        />

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {FEST.edicoesAnteriores.map((e) => (
            <article
              key={e.edicao}
              className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/50"
            >
              {e.fotos.length > 0 ? (
                <div className="relative h-44 overflow-hidden">
                  <img src={e.fotos[0]} alt={`${e.titulo} em Timóteo`} className="h-full w-full object-cover" loading="lazy" />
                </div>
              ) : (
                <div className="bg-glow grid h-24 place-items-center border-b border-border/60 bg-secondary/30">
                  <span className="font-display text-4xl font-bold text-primary/30">{e.edicao}ª</span>
                </div>
              )}

              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-display text-xl font-bold">{e.titulo}</h3>
                <div className="mt-1 text-sm text-muted-foreground">
                  {e.dataLabel && <span>{e.dataLabel}</span>}
                  {e.dataLabel && e.local && <span className="mx-1.5 text-border">|</span>}
                  {e.local && <span>{e.local}</span>}
                </div>

                <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">{e.resumo}</p>

                {e.atracoes.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {e.atracoes.map((a) => (
                      <span
                        key={a}
                        className="rounded-full border border-border/70 bg-secondary/40 px-3 py-1 text-xs text-muted-foreground"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        {FEST.naImprensa.length > 0 && (
          <div className="mt-14">
            <h3 className="text-center font-display text-xl font-semibold">O Fest Vale na imprensa</h3>
            <div className="mx-auto mt-6 grid max-w-3xl gap-4 sm:grid-cols-2">
              {FEST.naImprensa.map((m) => (
                <a
                  key={m.url}
                  href={m.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col rounded-2xl border border-border/60 bg-card/50 p-6 transition-colors hover:border-primary/50 hover:bg-card"
                >
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
                    <Newspaper className="h-3.5 w-3.5" />
                    {m.veiculo}
                    {m.dataLabel && <span className="font-normal normal-case tracking-normal text-muted-foreground">· {m.dataLabel}</span>}
                  </div>
                  <h4 className="mt-3 font-display text-base font-semibold leading-snug group-hover:text-primary">
                    {m.titulo}
                  </h4>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{m.resumo}</p>
                  <span className="mt-4 inline-flex items-center text-sm font-medium text-primary">
                    Ler a matéria
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------- Patrocinadores */

function Patrocinadores() {
  const lista = FEST.patrocinadores;
  const master = lista.filter((p) => p.nivel === "master");
  // Master tem card próprio; as demais cotas viram faixas de logo, na ordem oficial
  const demais = NIVEIS_PATROCINIO.filter((n) => n !== "master")
    .map((n) => ({ nivel: n, itens: lista.filter((p) => p.nivel === n) }))
    .filter((g) => g.itens.length > 0);
  const whatsapp: string = FEST.contato.whatsapp;
  const email: string = FEST.contato.email;
  const contato = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, "")}`
    : email
      ? `mailto:${email}?subject=Patroc%C3%ADnio%20Fest%20Vale`
      : null;

  return (
    <section id="patrocinadores" className="container mx-auto scroll-mt-20 px-4 py-20">
      <SectionHead
        eyebrow="Quem apoia"
        title="Patrocinadores e apoiadores"
        subtitle="Empresas que tornam o Fest Vale possível."
      />

      {lista.length > 0 ? (
        <div className="mt-10 space-y-6">
          {master.map((p) => (
            <MasterCard key={p.nome} p={p} />
          ))}
          {demais.map((g) => (
            <LogoGrid
              key={g.nivel}
              titulo={NIVEL_INFO[g.nivel].titulo}
              itens={g.itens}
              altura={NIVEL_INFO[g.nivel].altura}
              colunas={NIVEL_INFO[g.nivel].colunas}
            />
          ))}

          <div className="text-center">
            <Button variant="outline" asChild>
              <Link to="/patrocinadores">
                Conhecer todos os patrocinadores
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-dashed border-border/70 bg-card/30 p-10 text-center">
          <Handshake className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-4 text-sm text-muted-foreground">
            As marcas patrocinadoras da 4ª edição aparecem aqui assim que as cotas forem fechadas.
          </p>
        </div>
      )}

      <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center">
        <h3 className="font-display text-2xl font-bold">{FEST.patrocinioCta.titulo}</h3>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {FEST.patrocinioCta.texto}
        </p>
        {contato && (
          <Button className="mt-6" asChild>
            <a href={contato} target="_blank" rel="noreferrer">
              {FEST.patrocinioCta.contatoLabel}
            </a>
          </Button>
        )}
      </div>
    </section>
  );
}

/** Cota master: card largo, logo grande e o texto da empresa ao lado. */
function MasterCard({
  p,
}: {
  p: { nome: string; logo?: string; site?: string; descricao?: string };
}) {
  const marca = p.logo ? (
    <img src={p.logo} alt={p.nome} className="h-28 w-auto object-contain md:h-32" loading="lazy" />
  ) : (
    <span className="font-display text-3xl font-bold">{p.nome}</span>
  );

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-8">
      <div className="mb-1 text-center text-xs font-medium uppercase tracking-[0.2em] text-primary">
        Patrocínio master
      </div>
      <div className="mt-6 flex flex-col items-center gap-6 md:flex-row md:gap-10">
        <div className="shrink-0">
          {p.site ? (
            <a href={p.site} target="_blank" rel="noreferrer" className="transition-opacity hover:opacity-80">
              {marca}
            </a>
          ) : (
            marca
          )}
        </div>
        <div className="min-w-0 text-center md:text-left">
          <h3 className="font-display text-2xl font-bold">
            {p.nome} {FEST.apresenta.verbo} o {FEST.edicao}º {FEST.nome}
          </h3>
          {p.descricao && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.descricao}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LogoGrid({
  titulo,
  itens,
  altura,
  colunas,
}: {
  titulo: string;
  itens: Array<{ nome: string; logo?: string; site?: string }>;
  altura: string;
  colunas: string;
}) {
  return (
    <div>
      <div className="mb-3 text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {titulo}
      </div>
      <div className={`grid gap-4 ${colunas}`}>
        {itens.map((p) => {
          const conteudo = p.logo ? (
            <img src={p.logo} alt={p.nome} className={`${altura} w-auto object-contain`} loading="lazy" />
          ) : (
            <span className="font-display text-lg font-semibold">{p.nome}</span>
          );
          return (
            <div
              key={p.nome}
              className={`grid min-h-32 place-items-center rounded-xl border border-border/60 bg-card/60 p-6`}
            >
              {p.site ? (
                <a href={p.site} target="_blank" rel="noreferrer" className="transition-opacity hover:opacity-80">
                  {conteudo}
                </a>
              ) : (
                conteudo
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- Local e data */

function LocalEData() {
  return (
    <section id="local" className="scroll-mt-20 border-y border-border/60 bg-card/30">
      <div className="container mx-auto px-4 py-20">
        <SectionHead eyebrow="Onde e quando" title="Local e data" />

        <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
          <InfoCard
            icon={<CalendarDays className="h-5 w-5 text-primary" />}
            title="Data e horário"
            lines={[
              `${FEST.dataLabel} (${FEST.diaSemana})`,
              `Abertura dos portões às ${FEST.horaLabel}`,
              `Encerramento à ${FEST.horaFimLabel}`,
            ]}
          />
          <InfoCard
            icon={<MapPin className="h-5 w-5 text-primary" />}
            title="Local"
            lines={[FEST.local.nome, FEST.local.endereco]}
            action={
              <Button size="sm" variant="outline" asChild>
                <a href={mapsUrl(FEST.local.mapsQuery)} target="_blank" rel="noreferrer">
                  Abrir no Google Maps
                </a>
              </Button>
            }
          />
        </div>
      </div>
    </section>
  );
}

function InfoCard({
  icon,
  title,
  lines,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  lines: string[];
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border/60 bg-background/40 p-6">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-display text-lg font-semibold">{title}</h3>
      </div>
      <div className="mt-3 space-y-1 text-sm text-muted-foreground">
        {lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- FAQ */

function Faq() {
  return (
    <section id="faq" className="container mx-auto scroll-mt-20 px-4 py-20">
      <SectionHead eyebrow="Dúvidas" title="Perguntas frequentes" />
      <div className="mx-auto mt-10 max-w-3xl divide-y divide-border/60 rounded-2xl border border-border/60 bg-card/40">
        {FEST.faq.map((f) => (
          <details key={f.p} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium">
              {f.p}
              <span className="text-primary transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.r}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Rodapé */

function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="font-display text-2xl font-bold">
            {FEST.nome} <span className="text-primary">{FEST.cidade}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {FEST.edicaoLabel} · {FEST.dataLabel} · {FEST.cidade}/{FEST.estado}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            Realização {FEST.realizador.nome} — {FEST.realizador.cidade}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a href="#ingressos" className="hover:text-foreground">Ingressos</a>
            <a href="#atracoes" className="hover:text-foreground">Atrações</a>
            <a href="#patrocinadores" className="hover:text-foreground">Patrocinadores</a>
            <a href="#local" className="hover:text-foreground">Local</a>
            <a href="#faq" className="hover:text-foreground">Dúvidas</a>
            <Link to="/organizador" className="hover:text-foreground">Área do organizador</Link>
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            © {new Date().getFullYear()} {FEST.nome} {FEST.cidade}. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------ Genéricos */

function SectionHead({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : ""}>
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-primary">{eyebrow}</div>
      <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl">{title}</h2>
      {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
