/**
 * Dados do Fest Vale Timóteo.
 * Este é o único arquivo que precisa ser editado para atualizar textos,
 * datas, atrações e imagens do site. Nada aqui é buscado no banco.
 */

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
    hero: "",
    ogImage: "/img/logo.png",
  },

  atracoes: [
    {
      nome: "Gertrudes",
      papel: "Atração principal",
      descricao:
        "A banda Gertrudes sobe ao palco do Fest Vale com o show que mistura rock e MPB e já rodou o Vale do Aço.",
      imagem: "",
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
  ],

  /** Usados enquanto o evento ainda não foi cadastrado no painel do organizador. */
  lotesExemplo: [
    { tipo: "Pista", lote: "1º lote", precoCents: 6000, disponivel: true },
    { tipo: "Pista", lote: "2º lote", precoCents: 8000, disponivel: false },
    { tipo: "Área VIP", lote: "1º lote", precoCents: 12000, disponivel: true },
  ],

  /**
   * Patrocinadores e apoiadores. Adicione um item por empresa.
   * `logo` aceita caminho local (ex.: "/img/patrocinadores/empresa.png") ou URL.
   * Sem logo, o site desenha o nome da empresa em um card.
   * Níveis: "master" (destaque grande), "ouro", "apoio".
   */
  patrocinadores: [
    // { nome: "Empresa Exemplo", logo: "/img/patrocinadores/exemplo.png", site: "", nivel: "master" },
  ] as Array<{ nome: string; logo?: string; site?: string; nivel: "master" | "ouro" | "apoio" }>,

  /** Texto do convite para novas cotas de patrocínio. */
  patrocinioCta: {
    titulo: "Sua marca no Fest Vale",
    texto:
      "Ainda há cotas de patrocínio disponíveis para a 4ª edição. Associe sua empresa a um evento que reúne a cidade e sustenta ações sociais no Vale do Aço.",
    contatoLabel: "Falar sobre patrocínio",
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

export const mapsUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
