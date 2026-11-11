import { ImageResponse } from "next/og";
import { AppIconArt } from "@/lib/app-icon";

/** App icon (orange circle with a basketball) at 192 or 512 px, for the manifest. */
export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = raw === "512" ? 512 : 192;
  return new ImageResponse(<AppIconArt size={size} />, {
    width: size,
    height: size,
    headers: { "Cache-Control": "public, max-age=604800" },
  });
}
