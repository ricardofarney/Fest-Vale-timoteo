# Estado do projeto — Fest Vale Timóteo

Registro contínuo do que já foi feito, para que qualquer sessão de chat ou o
Cowork consiga retomar de onde parou. **Regra do projeto: ao finalizar uma
tarefa, registrar aqui o que foi feito, como foi verificado e o que ficou
pendente.**

Última atualização: 05/08/2026.

---

## 1. O que é

Site oficial e sistema de venda de ingressos da 4ª edição do Fest Vale Timóteo
(8 de maio de 2027, Área de Lazer Joaquim Augusto, bairro Santa Maria,
Timóteo/MG). Realização: Loja Maçônica Acácia de Acesita.

O projeto nasceu de um template do Lovable chamado "Palco" — daí sobrarem
referências a esse nome em alguns pontos do código (ver histórico abaixo).

## 2. Infraestrutura

| Item | Valor |
| --- | --- |
| Repositório | https://github.com/ricardofarney/Fest-Vale-timoteo (branch `main`) |
| Hospedagem | Vercel — **todo push na `main` dispara deploy automático** |
| Domínio | https://www.festvaletimoteo.com.br |
| Backend | Supabase (projeto `dwynfydbtkwwppwblkbu`) |
| Pasta local | `C:\Users\ricar\Documents\fest-vale` |

Observações de infraestrutura:

- O `.github/workflows/deploy.yml` (publicação no GitHub Pages) foi **removido**
  no commit `1cfd879`, já que o deploy passou a ser da Vercel. Não recriar.
- `public/CNAME` (`festvaletimoteo.com.br`) é resquício do GitHub Pages e hoje
  não tem efeito na Vercel — inofensivo, mas pode ser removido numa limpeza.
- `.env.production` é versionado de propósito (o `.gitignore` tem `!.env.production`).
  Contém apenas a URL do Supabase e a chave *publishable*, que são públicas.
  **Nenhum segredo real deve entrar aí.**
- A pasta local guarda arquivos que **não** pertencem ao projeto
  (`fest-vale-codigo-fonte.zip`, `backup-gigstream-sync-260804.zip`,
  `gigstream-sync_260804.backup`). Eles ficam fora do Git via
  `.git/info/exclude` (local, não versionado), e não pelo `.gitignore`.

## 3. Stack

- TanStack Start (React 19) + Vite + Tailwind CSS v4 + shadcn/ui
- Supabase para auth, Postgres e storage, acessado direto do navegador
- Build com pré-renderização (`npx vite build` gera `dist/client` e `dist/server`)

Conteúdo do festival (data, local, atrações, patrocinadores, FAQ, imagens)
fica centralizado em `src/lib/fest.ts`.

## 4. Como verificar antes de commitar

```bash
npx tsc --noEmit
npx vite build
```

Se `node_modules` não existir, rodar `npm install` antes. Atenção: com npm 11 /
Node 24 o `npm install` **reescreve o `package-lock.json`**; essa reescrita não
deve ser commitada junto com mudanças de código (usar `git restore package-lock.json`),
para não alterar resoluções de dependência sem intenção.

## 5. Histórico de tarefas

### 05/08/2026 — Commit inicial (`b753aa2`)

Código-fonte extraído de `fest-vale-codigo-fonte.zip`, repositório inicializado
na branch `main` e publicado no GitHub. 68 arquivos: rotas públicas (home,
página do evento, cadastro, login, checkout), área do organizador (dashboard,
criação e edição de eventos), validação de ingressos por QR code, migrations do
Supabase com RLS.

### 05/08/2026 — Títulos das páginas internas (`54116b7`)

Sete rotas ainda usavam o sufixo " — Palco" (nome do template do Lovable) na
propriedade `head`. Substituído por " — Fest Vale Timóteo", mantendo o restante
de cada título:

| Arquivo | Título novo |
| --- | --- |
| `src/routes/login.tsx` | Entrar — Fest Vale Timóteo |
| `src/routes/cadastro.tsx` | Criar conta — Fest Vale Timóteo |
| `src/routes/checkout.$orderId.tsx` | Finalizar compra — Fest Vale Timóteo |
| `src/routes/_authenticated/meus-ingressos.tsx` | Meus ingressos — Fest Vale Timóteo |
| `src/routes/_authenticated/organizador.tsx` | Painel do organizador — Fest Vale Timóteo |
| `src/routes/_authenticated/validacao.index.tsx` | Validação — Fest Vale Timóteo |
| `src/routes/_authenticated/validacao.$eventId.scanner.tsx` | Scanner — Fest Vale Timóteo |

Verificação: `npx tsc --noEmit` e `npx vite build` passaram (exit 0), e os
títulos foram conferidos em produção — `/login` e `/cadastro` já servem os
títulos novos. Não sobrou nenhuma ocorrência de "Palco" como nome de produto
no código (o texto "Quem sobe ao palco" em `src/routes/index.tsx` é conteúdo
editorial legítimo e foi mantido).

## 6. Pendências e pontos de atenção

- `package-lock.json` está com a reescrita do npm 11 no working tree local, não
  commitada. Decidir se descarta (`git restore package-lock.json`) ou se atualiza
  o lock de propósito.
- O `npm install` avisa que o postinstall do `esbuild` não roda por causa da
  política `allow-scripts` do npm 11. O build funciona mesmo assim.
- As rotas autenticadas são pré-renderizadas como a página de login (o
  prerender redireciona). Comportamento esperado, mas vale lembrar ao mexer
  em SEO das páginas internas.
- `public/CNAME` pode ser removido (ver seção 2).
