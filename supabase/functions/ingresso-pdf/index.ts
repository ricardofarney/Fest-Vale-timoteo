// Gera o ingresso em PDF, pronto para imprimir ou guardar no celular.
//
// Endereço: /functions/v1/ingresso-pdf?t=<qr_token>
//
// Roda sem login, igual à função que desenha o QR: quem tem o código do
// ingresso já tem o próprio ingresso. O código é aleatório e não dá para
// adivinhar — e é ele, não o PDF, que vale na portaria.
//
// Nenhum dado do comprador entra aqui: só o nome do participante, que é o que
// a portaria confere.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const erro = (msg: string, status: number) =>
  new Response(msg, { status, headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" } });

/** Acentos fora do Latin-1 quebram as fontes padrão do PDF. */
const limpa = (s: string) => s.replace(/[^\x20-\xFF]/g, "");

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const url = new URL(req.url);
    const token = (url.searchParams.get("t") ?? "").trim();
    if (!/^[a-f0-9]{16,64}$/i.test(token)) return erro("Código inválido.", 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: ticket } = await admin
      .from("tickets")
      .select("id, attendee_name, qr_token, status, order_id, ticket_batches(name, ticket_types(name, event_id))")
      .eq("qr_token", token)
      .maybeSingle();

    if (!ticket) return erro("Ingresso não encontrado.", 404);

    const batch = ticket.ticket_batches as
      { name?: string; ticket_types?: { name?: string; event_id?: string } } | null;
    const tipo = batch?.ticket_types?.name ?? "Ingresso";
    const lote = batch?.name ?? "";
    const eventId = batch?.ticket_types?.event_id;

    const { data: ev } = await admin
      .from("events")
      .select("name, starts_at, venue, address")
      .eq("id", eventId!)
      .maybeSingle();

    // O QR vem da mesma função que o e-mail usa: uma fonte só da verdade.
    const qrRes = await fetch(`${SUPABASE_URL}/functions/v1/qr?t=${token}&s=600`);
    if (!qrRes.ok) return erro("Não consegui gerar o QR Code agora.", 502);
    const qrBytes = new Uint8Array(await qrRes.arrayBuffer());

    const pdf = await PDFDocument.create();
    const pagina = pdf.addPage([595.28, 841.89]); // A4 em pontos
    const { width, height } = pagina.getSize();
    const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
    const normal = await pdf.embedFont(StandardFonts.Helvetica);
    const qr = await pdf.embedPng(qrBytes);

    const escuro = rgb(0.07, 0.07, 0.07);
    const cinza = rgb(0.42, 0.42, 0.42);
    const laranja = rgb(0.76, 0.25, 0.05);

    let y = height - 70;
    const centro = (texto: string, fonte: typeof normal, tam: number, cor = escuro) => {
      const t = limpa(texto);
      const largura = fonte.widthOfTextAtSize(t, tam);
      pagina.drawText(t, { x: (width - largura) / 2, y, size: tam, font: fonte, color: cor });
    };

    centro(ev?.name ?? "Fest Vale Timoteo", negrito, 22);
    y -= 26;
    if (ev?.starts_at) { centro(dataHora(ev.starts_at), normal, 12, cinza); y -= 18; }
    if (ev?.venue) { centro(ev.venue, normal, 12, cinza); y -= 18; }

    y -= 22;
    pagina.drawLine({
      start: { x: 60, y }, end: { x: width - 60, y },
      thickness: 1, color: rgb(0.88, 0.88, 0.88),
    });

    y -= 40;
    centro("INGRESSO", negrito, 11, laranja);
    y -= 28;
    centro(ticket.attendee_name ?? "Participante", negrito, 20);
    y -= 22;
    centro(`${tipo}${lote ? ` - ${lote}` : ""}`, normal, 13, cinza);

    // QR grande e centralizado: é o que a portaria lê
    const lado = 260;
    y -= lado + 30;
    pagina.drawImage(qr, { x: (width - lado) / 2, y, width: lado, height: lado });

    y -= 26;
    centro(`Codigo: ${ticket.qr_token}`, normal, 10, cinza);

    y -= 46;
    centro("Apresente este QR Code na entrada. Vale uma unica passagem.", normal, 11, cinza);
    y -= 16;
    centro("Pode ser apresentado direto na tela do celular.", normal, 11, cinza);

    if (ev?.address) {
      y -= 26;
      centro(ev.address, normal, 10, cinza);
    }

    const bytes = await pdf.save();
    const nome = `ingresso-${ticket.qr_token.slice(0, 8)}.pdf`;

    return new Response(bytes, {
      headers: {
        ...CORS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nome}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (e) {
    console.error("ingresso-pdf:", e);
    return erro("Nao consegui gerar o PDF agora.", 500);
  }
});
