# Fest Vale Timóteo

Site oficial e sistema de venda de ingressos da 4ª edição do Fest Vale Timóteo —
8 de maio de 2027, Área de Lazer Joaquim Augusto, bairro Santa Maria, Timóteo/MG.
Realização: Loja Maçônica Acácia de Acesita.

## Stack

- TanStack Start (React 19) + Vite + Tailwind CSS v4
- Supabase (Postgres, Auth, Storage) — acessado direto do navegador
- Build estático (SPA + pré-renderização), roda em qualquer hospedagem

## Rodar localmente

```bash
npm install
npm run dev      # http://localhost:8080
```

## Gerar o site para publicar

```bash
npm run build                  # saída em dist/client
bash scripts/build-estatico.sh # gera fest-vale-site.zip para hospedagem compartilhada
```

## Editar o conteúdo do festival

Tudo (data, local, atrações, patrocinadores, FAQ, imagens) está em **`src/lib/fest.ts`**.

## Banco de dados

As migrations em `supabase/migrations/` descrevem o schema completo: eventos, tipos
de ingresso, lotes, cupons, pedidos, ingressos com QR e log de check-in, com RLS
em todas as tabelas.
