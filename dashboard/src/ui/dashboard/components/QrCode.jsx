import React from "react";
import qrcode from "qrcode-generator";

/**
 * Renders a QR code as a crisp, scalable inline SVG.
 *
 * Uses `qrcode-generator` (pure JS, no canvas, no network) with medium error
 * correction so the code still scans even with minor damage or glare. The SVG
 * is built from the module matrix as a single path, so it stays sharp at any
 * size (home-screen icon, printed, zoomed).
 */
export function QrCode({ value, size = 220, margin = 4, className, ariaLabel }) {
  const { path, viewBox } = React.useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(String(value));
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        if (qr.isDark(r, c)) {
          d += `M${c + margin} ${r + margin}h1v1h-1z`;
        }
      }
    }
    const dim = n + margin * 2;
    return { path: d, viewBox: `0 0 ${dim} ${dim}` };
  }, [value]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      role="img"
      aria-label={ariaLabel || "QR code"}
      className={className}
      style={{ display: "block" }}
    >
      <rect width="100%" height="100%" className="fill-white" />
      <path d={path} className="fill-black" shapeRendering="crispEdges" />
    </svg>
  );
}