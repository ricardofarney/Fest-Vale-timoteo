// Gera a imagem PNG do QR Code de um ingresso.
// Público de propósito: o endereço só é útil para quem já tem o token do
// ingresso — que é o próprio segredo do QR e chega apenas ao comprador.
// Usado pelo e-mail do ingresso, onde <img> precisa de uma URL pública.
import QRCode from "npm:qrcode@1.5.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const token = url.searchParams.get("t") ?? "";
  const size = Math.min(Math.max(Number(url.searchParams.get("s") ?? 320), 120), 800);

  if (!/^[a-f0-9]{8,64}$/i.test(token)) {
    return new Response("token inválido", { status: 400, headers: CORS });
  }

  try {
    const dataUrl: string = await QRCode.toDataURL(token, {
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#111111", light: "#FFFFFF" },
    });
    const base64 = dataUrl.split(",")[1];
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    return new Response(bytes, {
      headers: {
        ...CORS,
        "Content-Type": "image/png",
        // O QR de um ingresso nunca muda: pode ficar em cache no cliente de e-mail
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("qr:", e);
    return new Response("erro ao gerar QR", { status: 500, headers: CORS });
  }
});
