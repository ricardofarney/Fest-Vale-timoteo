import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export function QrCanvas({ value, size = 220 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    QRCode.toCanvas(ref.current, value, {
      width: size,
      margin: 1,
      color: { dark: "#ffffff", light: "#00000000" },
      errorCorrectionLevel: "M",
    }).catch(() => undefined);
  }, [value, size]);
  return <canvas ref={ref} width={size} height={size} className="rounded-lg" />;
}
