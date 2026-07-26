export function MaintenanceEngineGraphic() {
  return (
    <svg
      viewBox="0 0 560 460"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-auto w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="engine-shell" x1="150" y1="60" x2="430" y2="410">
          <stop stopColor="#1c1927" />
          <stop offset="1" stopColor="#0e0e12" />
        </linearGradient>
        <linearGradient id="engine-line" x1="42" y1="230" x2="518" y2="230">
          <stop stopColor="#7768b8" stopOpacity="0" />
          <stop offset="0.5" stopColor="#b0a0ea" />
          <stop offset="1" stopColor="#7768b8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="engine-core" cx="0" cy="0" r="1" gradientTransform="translate(280 230) rotate(90) scale(75)">
          <stop stopColor="#b0a0ea" stopOpacity="0.28" />
          <stop offset="1" stopColor="#b0a0ea" stopOpacity="0" />
        </radialGradient>
        <filter id="engine-glow" x="190" y="140" width="180" height="180" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="22" />
        </filter>
      </defs>

      <path d="M36 230H524" stroke="url(#engine-line)" strokeWidth="1" />
      <path d="M280 18V442" stroke="#292631" strokeWidth="1" strokeDasharray="4 8" />
      <circle cx="280" cy="230" r="196" stroke="#24222a" />
      <circle cx="280" cy="230" r="158" stroke="#24222a" strokeDasharray="3 9" />

      <g opacity="0.8">
        <path d="M84 126H160L190 156" stroke="#3b3748" />
        <circle cx="80" cy="126" r="4" fill="#b0a0ea" />
        <path d="M476 334H400L370 304" stroke="#3b3748" />
        <circle cx="480" cy="334" r="4" fill="#b0a0ea" />
        <path d="M88 348H148L178 318" stroke="#2e2b36" />
        <circle cx="84" cy="348" r="3" fill="#625a7c" />
        <path d="M472 112H412L382 142" stroke="#2e2b36" />
        <circle cx="476" cy="112" r="3" fill="#625a7c" />
      </g>

      <circle cx="280" cy="230" r="75" fill="url(#engine-core)" filter="url(#engine-glow)" />
      <rect x="166" y="86" width="228" height="288" rx="24" fill="url(#engine-shell)" stroke="#3b3748" />
      <rect x="184" y="104" width="192" height="252" rx="14" fill="#0b0b0e" stroke="#292631" />

      {[132, 190, 248, 306].map((y, index) => (
        <g key={y}>
          <rect x="202" y={y} width="156" height="40" rx="8" fill="#15141a" stroke="#35313f" />
          <circle cx="222" cy={y + 20} r="4" fill={index === 1 ? "#b0a0ea" : "#565062"} />
          <path d={`M240 ${y + 16}H318M240 ${y + 24}H296`} stroke="#484351" strokeWidth="3" strokeLinecap="round" />
          <rect x="330" y={y + 14} width="10" height="12" rx="3" fill="#292631" />
        </g>
      ))}

      <g className="motion-safe:animate-pulse">
        <circle cx="280" cy="230" r="27" fill="#17141f" stroke="#8173c4" />
        <path d="M269 230H291M280 219V241" stroke="#c9bef4" strokeWidth="2" strokeLinecap="round" />
        <circle cx="280" cy="230" r="38" stroke="#b0a0ea" strokeOpacity="0.22" />
      </g>

      <path d="M172 230H242M318 230H388" stroke="#8173c4" strokeWidth="2" strokeDasharray="4 6" />
      <circle cx="166" cy="230" r="5" fill="#b0a0ea" />
      <circle cx="394" cy="230" r="5" fill="#b0a0ea" />
    </svg>
  );
}
