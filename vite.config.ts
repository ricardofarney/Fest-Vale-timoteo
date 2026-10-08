import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Build estático (SPA): gera dist/client pronto para hospedagem compartilhada.
export default defineConfig({
  server: { port: 8080, host: true },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      server: { entry: "server" },
      spa: { enabled: true },
      prerender: {
        enabled: true,
        crawlLinks: true,
        // Arquivos de /docs (PDFs) são estáticos: o crawler não pode reescrevê-los,
        // senão o PDF sai corrompido no build.
        filter: ({ path }: { path: string }) => !path.startsWith("/docs/"),
      },
    }),
    viteReact(),
  ],
});
