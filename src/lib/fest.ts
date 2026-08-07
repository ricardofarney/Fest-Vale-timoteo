/**
 * Dados do Fest Vale Timóteo.
 * Este é o único arquivo que precisa ser editado para atualizar textos,
 * datas, atrações e imagens do site. Nada aqui é buscado no banco.
 */

/** Cotas de patrocínio, da maior para a menor. A ordem aqui manda no site. */
export const NIVEIS_PATROCINIO = ["master", "ouro", "prata", "bronze", "cobre"] as const;
export type NivelPatrocinio = (typeof NIVEIS_PATROCINIO)[number];

/** Como cada cota aparece: título da faixa e tamanho do logo. */
export const NIVEL_INFO: Record<NivelPatrocinio, { titulo: string; altura: string; colunas: string }> = {
  master: { titulo: "Patrocínio master", altura: "h-28", colunas: "sm:grid-cols-2" },
  ouro:   { titulo: "Patrocínio ouro",   altura: "h-20", colunas: "sm:grid-cols-2 lg:grid-cols-3" },
  prata:  { titulo: "Patrocínio prata",  altura: "h-16", colunas: "sm:grid-cols-3 lg:grid-cols-4" },
  bronze: { titulo: "Patrocínio bronze", altura: "h-14", colunas: "sm:grid-cols-3 lg:grid-cols-4" },
  cobre:  { titulo: "Patrocínio cobre",  altura: "h-12", colunas: "sm:grid-cols-4 lg:grid-cols-5" },
};

export const FEST = {
  nome: "Fest Vale",
  cidade: "Timóteo",
  estado: "MG",
  edicao: 4,
  edicaoLabel: "4ª edição",
  slug: "fest-vale-timoteo-2027",

  /** Data e hora de início. Horário provisório — confirmar. */
  dataISO: "2027-05-08T18:00:00-03:00",
  dataLabel: "8 de maio de 2027",
  diaSemana: "sábado",
  horaLabel: "18h",

  realizador: {
    nome: "Loja Maçônica Acácia de Acesita",
    cidade: "Timóteo, MG",
  },

  local: {
    nome: "Área de Lazer Joaquim Augusto",
    endereco: "Bairro Santa Maria — Timóteo, MG",
    mapsQuery: "Área de Lazer Joaquim Augusto, Santa Maria, Timóteo, MG",
  },

  /** Domínio oficial do site. */
  dominio: "festvaletimoteo.com.br",

  /**
   * Endereço completo do site, com https e sem barra no fim.
   * Usado para montar as URLs absolutas da prévia de link
   * (WhatsApp, Facebook, Instagram, X) — links relativos não funcionam ali.
   */
  urlBase: "https://www.festvaletimoteo.com.br",

  /**
   * Login com Google. Só ative depois de configurar o provedor Google no
   * painel do Supabase (Authentication > Providers). Com false, o botão
   * some das telas de login e cadastro.
   */
  googleHabilitado: false,

  contato: {
    email: "",
    whatsapp: "",
    instagram: "",
  },

  /**
   * Imagens do site. Deixe vazio para o site desenhar um placeholder
   * gráfico no lugar. Troque pelo caminho do arquivo (ex.: "/img/hero.jpg")
   * ou por uma URL completa quando o material oficial chegar.
   */
  imagens: {
    logo: "/img/logo.png",
    /** Imagem de fundo do topo (cobre a seção inteira, em opacidade reduzida). */
    hero: "",
    /** Recorte da atração principal, exibido no rodapé do topo. Fundo transparente. */
    heroBanda: "/img/gertrudes-banda.webp",
    heroBandaLegenda: "Atração principal — banda Gertrudes",
    /**
     * Arte da prévia de link (WhatsApp, Facebook, Instagram, X).
     * Formato ideal: 1200x630 px, JPG ou PNG, abaixo de 300 KB.
     * Ao trocar o arquivo, mude também o nome — as redes guardam a
     * imagem em cache por dias e só reconhecem uma URL nova.
     */
    ogImage: "/img/og-banner.jpg",
    ogImageLargura: 1200,
    ogImageAltura: 630,
    ogImageAlt: "4º Fest Vale — salve essa data: 8 de maio de 2027",
  },

  /**
   * Atrações do line-up.
   * Campos opcionais do card de destaque:
   *   `bio`        — parágrafos extras exibidos abaixo da descrição
   *   `integrantes`— lista "Nome — instrumento"
   *   `tags`       — etiquetas de estilo/repertório
   *   `redes`      — links (tipo: instagram | youtube | spotify | site)
   *   `videoId`    — ID de vídeo do YouTube para o player embutido
   */
  atracoes: [
    {
      nome: "Gertrudes",
      papel: "1ª banda confirmada",
      descricao:
        "Nome tradicional do Vale do Aço, a Gertrudes construiu sua reputação tocando clássicos do rock com execução precisa — e é ela que fecha a noite do Fest Vale.",
      bio: [
        "O repertório passeia pelo rock e pop dos anos 70 e 80, do internacional ao nacional: a-ha, Simply Red, R.E.M., Men at Work e Dire Straits convivem com Iron Maiden, Bon Jovi, Metallica, Guns N' Roses e Pink Floyd.",
        "Com passagens por casas e eventos de toda a região — incluindo o Dia Mundial do Rock no Shopping Vale do Aço e o Sunset Classic Rock do Instituto Usiminas — a banda faz o tipo de show em que a plateia canta junto do começo ao fim.",
      ],
      integrantes: [
        "Jayme Souz — voz e guitarra",
        "Brenner Fernandes — guitarra",
        "Sid Bass — baixo",
        "Hilder Anício — bateria",
      ],
      tags: ["Classic rock", "Pop anos 70/80", "Rock nacional"],
      redes: [
        { tipo: "instagram", url: "https://www.instagram.com/bandagertrudesoficial/", label: "@bandagertrudesoficial" },
        { tipo: "youtube", url: "https://www.youtube.com/c/bandagertrudesoficial", label: "Banda Gertrudes Oficial" },
      ],
      videoId: "a31dapQxl9I",
      imagem: "/img/gertrudes-banda.webp",
      destaque: true,
    },
    {
      nome: "Atração a confirmar",
      papel: "Line-up em construção",
      descricao: "Mais nomes serão anunciados nas próximas semanas.",
      imagem: "",
      destaque: false,
    },
    {
      nome: "Atração a confirmar",
      papel: "Line-up em construção",
      descricao: "Mais nomes serão anunciados nas próximas semanas.",
      imagem: "",
      destaque: false,
    },
  ] as ReadonlyArray<{
    nome: string;
    papel: string;
    descricao: string;
    imagem: string;
    destaque: boolean;
    bio?: readonly string[];
    integrantes?: readonly string[];
    tags?: readonly string[];
    redes?: ReadonlyArray<{ tipo: "instagram" | "youtube" | "spotify" | "site"; url: string; label: string }>;
    videoId?: string;
  }>,

  /**
   * Edições anteriores. `fotos` aceita caminhos locais (ex.: "/img/edicoes/2026-01.jpg").
   * Enquanto estiver vazio, o site mostra só o resumo em texto — nenhuma imagem quebrada.
   */
  edicoesAnteriores: [
    {
      edicao: 3,
      titulo: "3º Fest Vale",
      dataLabel: "9 de maio de 2026",
      local: "Área de Lazer Joaquim Augusto — bairro Santa Maria",
      resumo:
        "Três bandas no palco e a área de lazer cheia: a edição de 2026 teve Gertrudes, Polivalência e IA JOE, com ingressos a R$ 25 no segundo lote e venda também em pontos físicos espalhados pela cidade.",
      atracoes: ["Gertrudes", "Polivalência", "IA JOE"],
      fotos: [] as string[],
    },
    {
      edicao: 2,
      titulo: "2º Fest Vale",
      dataLabel: "",
      local: "Timóteo, MG",
      resumo:
        "A segunda edição consolidou o formato: música ao vivo, praça de alimentação e a renda inteira revertida para as ações sociais da loja.",
      atracoes: [] as string[],
      fotos: [] as string[],
    },
    {
      edicao: 1,
      titulo: "1º Fest Vale",
      dataLabel: "",
      local: "Timóteo, MG",
      resumo:
        "A festa nasceu como um encontro da comunidade em torno de uma causa — e desde a estreia toda a arrecadação sustenta os projetos sociais mantidos pela loja no Vale do Aço.",
      atracoes: [] as string[],
      fotos: [] as string[],
    },
  ],

  /**
   * Matérias publicadas sobre o evento. Preferência para o Só Aqui Notícias,
   * parceiro de imprensa do Fest Vale.
   */
  naImprensa: [
    {
      veiculo: "Só Aqui Notícias",
      titulo: "3º Fest Vale já tem data marcada e promete agitar Timóteo",
      resumo:
        "O anúncio da edição de 2026, com Gertrudes e Polivalência confirmadas e a organização a cargo da Loja Maçônica Acácia de Acesita e da Fraternidade Feminina Cruzeiro do Sul.",
      url: "https://soaquinoticias.com.br/3o-fest-vale-ja-tem-data-marcada-e-promete-agitar-timoteo/",
      dataLabel: "abril de 2026",
    },
    {
      veiculo: "Só Aqui Notícias",
      titulo: "3º Fest Vale movimenta Timóteo neste sábado (09/05)",
      resumo:
        "A cobertura da véspera, com o line-up completo, os pontos de venda de ingressos e a destinação da renda para ações filantrópicas.",
      url: "https://soaquinoticias.com.br/3o-fest-vale-movimenta-timoteo-neste-sabado-09-05/",
      dataLabel: "maio de 2026",
    },
  ],

  /** Usados enquanto o evento ainda não foi cadastrado no painel do organizador. */
  lotesExemplo: [
    { tipo: "Pista", lote: "1º lote", precoCents: 6000, disponivel: true },
    { tipo: "Pista", lote: "2º lote", precoCents: 8000, disponivel: false },
    { tipo: "Área VIP", lote: "1º lote", precoCents: 12000, disponivel: true },
  ],

  /**
   * Patrocinador que APRESENTA o evento — a cota master.
   * Aparece no topo da home, antes do nome do festival ("Netvale apresenta"),
   * e abre a página de patrocinadores.
   * Deixe `nome` vazio para o site esconder a assinatura por completo.
   * Sem `logo`, o nome é desenhado com a tipografia do site.
   */
  apresenta: {
    nome: "Netvale",
    /** Versão de letra branca — o site tem fundo escuro. */
    logo: "/img/patrocinadores/netvale.webp",
    /** Versão de letra preta, para e-mail e qualquer peça de fundo claro. */
    logoFundoClaro: "/img/patrocinadores/netvale-fundo-claro.webp",
    site: "https://netvale.psi.br/",
    /** Frase montada no hero: "<nome> apresenta" + nome do evento. */
    verbo: "apresenta",
  },

  /**
   * Patrocinadores e apoiadores. Adicione um item por empresa.
   * `logo` aceita caminho local (ex.: "/img/patrocinadores/empresa.png") ou URL.
   * Sem logo, o site desenha o nome da empresa em um card.
   * Níveis, do maior para o menor: "master", "ouro", "prata", "bronze", "cobre".
   * `descricao` só aparece na página /patrocinadores — é opcional.
   */
  patrocinadores: [
    {
      nome: "Netvale",
      logo: "/img/patrocinadores/netvale.webp",
      site: "https://netvale.psi.br/",
      nivel: "master",
      descricao:
        "Provedora de internet do Vale do Aço, a Netvale apresenta a 4ª edição do Fest Vale. " +
        "É o patrocínio que sustenta a estrutura da festa e faz com que a renda dos ingressos " +
        "chegue inteira nas ações sociais da loja.",
    },
  ] as Array<{
    nome: string;
    logo?: string;
    site?: string;
    nivel: NivelPatrocinio;
    descricao?: string;
  }>,

  /** Texto do convite para novas cotas de patrocínio. */
  patrocinioCta: {
    titulo: "Sua marca no Fest Vale",
    texto:
      "Ainda há cotas de patrocínio disponíveis para a 4ª edição. Associe sua empresa a um evento que reúne a cidade e sustenta ações sociais no Vale do Aço.",
    contatoLabel: "Falar sobre patrocínio",
  },

  /** Conteúdo da página dedicada /patrocinadores. */
  patrocinioPagina: {
    titulo: "Quem faz o Fest Vale acontecer",
    intro:
      "O Fest Vale só existe porque empresas da região decidem colocar o nome delas em uma festa que devolve o resultado para a cidade. " +
      "A renda do evento sustenta as ações sociais mantidas pela Loja Maçônica Acácia de Acesita no Vale do Aço — " +
      "cada cota de patrocínio vira estrutura, e cada ingresso vendido vira trabalho social.",
    /**
     * O que cada cota entrega. PROPOSTA — conferir com a diretoria antes
     * de usar como argumento de venda. Ordem: da maior para a menor.
     */
    cotas: [
      {
        nome: "Master",
        resumo: "Assina o evento",
        itens: [
          "Marca ao lado da logo do festival no topo do site, assinando o evento",
          "Logo em destaque em toda a comunicação e no material impresso",
          "Espaço no palco e citação da locução durante o evento",
          "Exclusividade de segmento",
        ],
      },
      {
        nome: "Ouro",
        resumo: "Presença forte",
        itens: [
          "Logo em destaque na página de patrocinadores e na home",
          "Marca em todo o material de divulgação",
          "Citação da locução durante o evento",
          "Espaço para ativação da marca no local",
        ],
      },
      {
        nome: "Prata",
        resumo: "Boa visibilidade",
        itens: [
          "Logo na página de patrocinadores e na home",
          "Marca no material de divulgação",
          "Citação da locução durante o evento",
        ],
      },
      {
        nome: "Bronze",
        resumo: "Marca presente",
        itens: [
          "Logo na página de patrocinadores e na home",
          "Menção nas redes sociais do evento",
        ],
      },
      {
        nome: "Cobre",
        resumo: "Apoio institucional",
        itens: [
          "Logo na página de patrocinadores",
          "Menção nas redes sociais do evento",
        ],
      },
    ],
  },

  sobre: {
    titulo: "Uma festa que sustenta o ano inteiro de trabalho social",
    paragrafos: [
      "O Fest Vale nasceu como a festa da cidade e chega em 2027 à sua 4ª edição, reunindo famílias, amigos e música ao vivo em Timóteo.",
      "A realização é da Loja Maçônica Acácia de Acesita, e a renda do evento sustenta as ações sociais mantidas pela loja na região do Vale do Aço.",
      "Cada ingresso vendido vira apoio direto a essas ações — por isso a compra é feita aqui, no site oficial, sem intermediário.",
    ],
  },

  faq: [
    {
      p: "Quando e onde acontece?",
      r: "No dia 8 de maio de 2027, a partir das 18h, na Área de Lazer Joaquim Augusto, bairro Santa Maria, em Timóteo (MG).",
    },
    {
      p: "Como recebo meu ingresso?",
      r: "O ingresso é digital. Depois da compra ele fica disponível em 'Meus ingressos', com um QR Code que é lido na entrada do evento.",
    },
    {
      p: "Posso comprar para outras pessoas?",
      r: "Pode. Na hora da compra você informa o nome de cada participante e cada ingresso recebe um QR Code próprio.",
    },
    {
      p: "Tem meia-entrada?",
      r: "Sim, conforme a legislação. Leve o documento comprobatório para apresentar na entrada.",
    },
  ],
} as const;

/** Transforma um caminho do site ("/img/x.jpg") em URL absoluta, exigida pelas prévias de link. */
export const absUrl = (path: string) =>
  path.startsWith("http") ? path : `${FEST.urlBase}${path.startsWith("/") ? "" : "/"}${path}`;

export const mapsUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
