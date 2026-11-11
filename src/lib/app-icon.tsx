/** Basketball drawn with SVG shapes (no emoji font download), used for app icons. */
export function AppIconArt({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ea580c",
      }}
    >
      <svg width={size * 0.66} height={size * 0.66} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="46" fill="#f97316" stroke="#1f2937" strokeWidth="5" />
        <path d="M50 4 V96 M4 50 H96" stroke="#1f2937" strokeWidth="5" fill="none" />
        <path d="M20 13 C38 32 38 68 20 87 M80 13 C62 32 62 68 80 87" stroke="#1f2937" strokeWidth="5" fill="none" />
      </svg>
    </div>
  );
}
