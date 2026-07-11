import "./WorkspaceWaterBg.css";

/**
 * Decorative flowing-water atmosphere for the workspace main pane.
 * CSS/SVG only — no scroll listeners. Honors prefers-reduced-motion.
 */
export function WorkspaceWaterBg() {
  return (
    <div
      className="workspace-water pointer-events-none relative h-full w-full overflow-hidden"
      aria-hidden
    >
      <div className="workspace-water__base" />
      <div className="workspace-water__caustic workspace-water__caustic--a" />
      <div className="workspace-water__caustic workspace-water__caustic--b" />
      <div className="workspace-water__caustic workspace-water__caustic--c" />

      <svg
        className="workspace-water__waves"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ww-wave-a" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(0 212 255)" stopOpacity="0" />
            <stop offset="40%" stopColor="rgb(0 212 255)" stopOpacity="0.22" />
            <stop offset="70%" stopColor="rgb(0 255 136)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="rgb(0 212 255)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ww-wave-b" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(0 255 136)" stopOpacity="0" />
            <stop offset="35%" stopColor="rgb(0 255 136)" stopOpacity="0.12" />
            <stop offset="65%" stopColor="rgb(0 212 255)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="rgb(0 255 136)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="workspace-water__wave-layer workspace-water__wave-layer--1">
          <path
            fill="url(#ww-wave-a)"
            d="M0,192L48,186.7C96,181,192,171,288,176C384,181,480,203,576,197.3C672,192,768,160,864,149.3C960,139,1056,149,1152,165.3C1248,181,1344,203,1392,213.3L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
          />
        </g>
        <g className="workspace-water__wave-layer workspace-water__wave-layer--2">
          <path
            fill="url(#ww-wave-b)"
            d="M0,224L60,213.3C120,203,240,181,360,181.3C480,181,600,203,720,208C840,213,960,203,1080,186.7C1200,171,1320,149,1380,138.7L1440,128L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
          />
        </g>
        <g className="workspace-water__wave-layer workspace-water__wave-layer--3">
          <path
            fill="rgb(0 212 255 / 0.06)"
            d="M0,256L80,245.3C160,235,320,213,480,208C640,203,800,213,960,224C1120,235,1280,245,1360,250.7L1440,256L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"
          />
        </g>
      </svg>

      <div className="workspace-water__sheen" />
    </div>
  );
}
