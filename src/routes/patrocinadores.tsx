import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FEST, absUrl, NIVEIS_PATROCINIO, NIVEL_INFO } from "@/lib/fest";
import { BotaoWhatsapp } from "@/components/botao-whatsapp";
import { ArrowLeft, Check, FileDown, Handshake, Ticket } from "lucide-react";

export const Route = createFileRoute("/patrocinadores")({
  head: () => ({
    meta: [
      { title: `Patrocinadores — ${FEST.nome} ${FEST.cidade}` },
      {
        name: "description",
        content:
          `Empresas que patrocinam o ${FEST.edicaoLabel} do ${FEST.nome} ${FEST.cidade} ` +
          `e as cotas de patrocínio ainda disponíveis.`,
      },
      { property: "og:title", content: `Patrocinadores — ${FEST.nome} ${FEST.cidade}` },
      { property: "og:url", content: absUrl("/patrocinadores") },
    ],
    links: [{ rel: "canonical", href: absUrl("/patrocinadores") }],
  }),
  component: PaginaPatrocinadores,
});

type Patrocinador = (typeof FEST.patrocinadores)[number];

function PaginaPatrocinadores() {
  const lista = FEST.patrocinadores;
  const master = lista.filter((p) => p.nivel === "master");
  // As cotas abaixo da master viram faixas de logo, sempre na ordem oficial
  const demais = NIVEIS_PATROCINIO.filter((n) => n !== "master")
    .map((n) => ({ nivel: n, itens: lista.filter((p) => p.nivel === n) }))
    .filter((g) => g.itens.length > 0);

  const pagina = FEST.patrocinioPagina;
  const whatsapp: string = FEST.contato.whatsapp;
  const email: string = FEST.contato.email;
  const contato = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(FEST.whatsappMensagens.patrocinio)}`
    : email
      ? `mailto:${email}?subject=Patroc%C3%ADnio%20Fest%20Vale`
      : null;

  return (
    <div className="bg-glow">
      {/* ───────────────────────────────────────────────────────── topo */}
      <section className="border-b border-border/60">
        <div className="container mx-auto px-4 py-14 md:py-20">
          <Link
            to="/"
            className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Voltar para o site
          </Link>

          <div className="mt-6 max-w-3xl">
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
              Quem apoia
            </div>
            <h1 className="mt-3 font-display text-4xl font-bold leading-tight md:text-5xl">
              {FEST.patrocinioPagina.titulo}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">
              {FEST.patrocinioPagina.intro}
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto space-y-16 px-4 py-16">
        {/* ─────────────────────────────────────────────────────── master */}
        {master.map((p) => (
          <MasterDestaque key={p.nome} p={p} />
        ))}

        {/* ──────────────────────── ouro, prata, bronze e cobre */}
        {demais.map((g) => (
          <Faixa
            key={g.nivel}
            titulo={NIVEL_INFO[g.nivel].titulo}
            itens={g.itens}
            altura={NIVEL_INFO[g.nivel].altura}
            colunas={NIVEL_INFO[g.nivel].colunas}
          />
        ))}

        {lista.length === 0 && (
          <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-border/70 bg-card/30 p-12 text-center">
            <Handshake className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-4 text-sm text-muted-foreground">
              As marcas patrocinadoras do {FEST.edicaoLabel} aparecem aqui assim que as cotas forem fechadas.
            </p>
          </div>
        )}

        {/* ───────────────────────────────────────────────────── cotas */}
        <section id="cotas" className="scroll-mt-24">
          <div className="text-center">
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
              Cotas de patrocínio
            </div>
            <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl">
              Cinco formas de participar
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Cotas para o {FEST.edicaoLabel}, em {FEST.dataLabel}. Quanto maior a cota, em mais lugares
              a sua marca aparece, antes e durante a festa.
            </p>
            <div className="mt-6 inline-flex items-baseline gap-3 rounded-full border border-border/60 bg-card/50 px-5 py-2">
              <span className="whitespace-nowrap font-display text-2xl font-bold text-primary">{pagina.publico}</span>
              <span className="text-sm text-muted-foreground">{pagina.publicoLegenda}</span>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {pagina.cotas.map((c, i) => (
              <div
                key={c.nome}
                className={`flex flex-col rounded-2xl border p-6 ${
                  i === 0
                    ? "border-primary/40 bg-gradient-to-b from-primary/10 to-transparent"
                    : "border-border/60 bg-card/50"
                }`}
              >
                <h3 className="font-display text-xl font-bold leading-tight">{c.nome}</h3>
                <div className="mt-2 font-display text-3xl font-bold tabular-nums">{c.preco}</div>
                <p className="mt-1 text-sm text-muted-foreground">{c.resumo}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {c.itens.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm leading-relaxed">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex items-center gap-2 border-t border-border/60 pt-4 text-sm">
                  <Ticket className="h-4 w-4 text-primary" />
                  <span>
                    <strong className="font-semibold">{c.ingressos}</strong> ingressos de cortesia
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" variant="outline" asChild>
              <a href={pagina.cartaPdf} download target="_blank" rel="noreferrer">
                <FileDown className="mr-2 h-4 w-4" />
                Baixar a carta de patrocínio (PDF)
              </a>
            </Button>
            {contato && (
              <Button size="lg" asChild>
                <a href={contato} target="_blank" rel="noreferrer">
                  {FEST.patrocinioCta.contatoLabel}
                </a>
              </Button>
            )}
          </div>
        </section>

        {/* ──────────────────────────────────────── onde a marca aparece */}
        <section>
          <div className="text-center">
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
              Onde a sua marca aparece
            </div>
            <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl">Da rua ao palco</h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pagina.midias.map((m) => (
              <figure key={m.titulo} className="min-w-0">
                <div className="overflow-hidden rounded-2xl border border-border/60 bg-white">
                  <img
                    src={m.imagem}
                    alt={m.titulo}
                    loading="lazy"
                    className="aspect-[16/10] w-full object-contain"
                  />
                </div>
                <figcaption className="mt-3">
                  <div className="font-display font-semibold">{m.titulo}</div>
                  <div className="text-sm text-muted-foreground">{m.cotas}</div>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Peças ilustrativas. As artes finais trazem as marcas dos patrocinadores confirmados.
          </p>
        </section>

        {/* ───────────────────────────────────────────────── chamada */}
        <section className="mx-auto max-w-3xl rounded-2xl border border-primary/30 bg-primary/5 p-10 text-center">
          <h2 className="font-display text-2xl font-bold md:text-3xl">
            {FEST.patrocinioCta.titulo}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {FEST.patrocinioCta.texto}
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {contato && (
              <Button size="lg" asChild>
                <a href={contato} target="_blank" rel="noreferrer">
                  {FEST.patrocinioCta.contatoLabel}
                </a>
              </Button>
            )}
            <Button size="lg" variant="outline" asChild>
              <Link to="/">
                <Ticket className="mr-2 h-4 w-4" />
                Ver ingressos
              </Link>
            </Button>
          </div>
        </section>
      </div>
      <BotaoWhatsapp />
  </div>
  );
}

/** Bloco grande da cota master, com a assinatura do evento. */
function MasterDestaque({ p }: { p: Patrocinador }) {
  const marca = p.logo ? (
    <img src={p.logo} alt={p.nome} className="h-36 w-auto object-contain md:h-44" />
  ) : (
    <span className="font-display text-4xl font-bold">{p.nome}</span>
  );

  return (
    <section className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-8 md:p-12">
      <div className="text-center text-xs font-medium uppercase tracking-[0.2em] text-primary">
        Patrocínio master
      </div>

      <div className="mt-8 flex flex-col items-center gap-8 md:flex-row md:gap-14">
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
          <h2 className="font-display text-3xl font-bold leading-tight md:text-4xl">
            {p.nome} {FEST.apresenta.verbo} o {FEST.edicao}º {FEST.nome} {FEST.cidade}
          </h2>
          {p.descricao && (
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">{p.descricao}</p>
          )}
          {p.site && (
            <Button variant="outline" className="mt-6" asChild>
              <a href={p.site} target="_blank" rel="noreferrer">
                Conhecer a {p.nome}
              </a>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

/** Faixa de logos de uma cota. */
function Faixa({
  titulo,
  itens,
  altura,
  colunas,
}: {
  titulo: string;
  itens: Patrocinador[];
  altura: string;
  colunas: string;
}) {
  return (
    <section>
      <div className="mb-5 text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {titulo}
      </div>
      <div className={`grid gap-4 ${colunas}`}>
        {itens.map((p) => {
          const conteudo = p.logo ? (
            <img src={p.logo} alt={p.nome} className={`${altura} w-auto object-contain`} loading="lazy" />
          ) : (
            <span className="font-display text-xl font-semibold">{p.nome}</span>
          );
          return (
            <div
              key={p.nome}
              className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-7 text-center"
            >
              {p.site ? (
                <a href={p.site} target="_blank" rel="noreferrer" className="transition-opacity hover:opacity-80">
                  {conteudo}
                </a>
              ) : (
                conteudo
              )}
              {p.descricao && (
                <p className="text-xs leading-relaxed text-muted-foreground">{p.descricao}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
