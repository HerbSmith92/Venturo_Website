export function PassportScene({ complete }: { complete: boolean }) {
  return (
    <div className="passport-art" aria-hidden="true">
      <svg viewBox="0 0 480 340" className="passport-scene">
        <rect width="480" height="340" fill="#F6F0DE" />
        <g fill="none" stroke="#E4D7B4" strokeWidth="1.2" opacity="0.9">
          <path d="M20 40c40 8 70-18 120-8s70 28 120 16 80-30 140-10" />
          <path d="M10 90c50 16 90-20 150-6s90 30 150 8 80-24 120-6" />
          <path d="M30 300c60-14 100 18 160 4s90-28 150-8 70 16 110 2" />
        </g>
        <circle cx="78" cy="72" r="42" fill="#F3BF4A" />
        <path d="M148 58c7 5 7 12 0 16M166 46c9 7 9 16 0 22M184 56c6 4 6 10 0 14" stroke="#2A2D35" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M0 176c48-36 78-18 112 8 28 22 52-8 88-28 34-18 58 6 96 22 30 12 62-20 104-8 28 8 48 4 80-6v48H0Z" fill="#5E7A42" />
        <path d="M0 198 64 146l46 28 58-46 42 24 36-30 52 22 48-18 46 16 88-24v62H0Z" fill="#2A2D35" />
        <path d="M0 236c36-22 72 4 110 10 42 6 58-24 104-10 36 12 64-8 108 6 32 10 58 2 78-4 24-6 48-2 80 8v94H0Z" fill="#7C9A4E" />
        <path d="M250 210c-8 18-22 36-28 62-8 28 4 48 18 68h34c-6-22 2-46 10-68 8-22 6-46-8-62-8-8-18-8-26 0Z" fill="#E7C56A" />
        <path d="M232 248c-6 16-4 34 6 52 8 16 10 28 6 40h-28c-2-16 2-32 8-46 6-16 8-32 8-46Z" fill="#F3BF4A" />
        <path d="M214 286c8-10 22-8 32 2 8 8 10 18 6 28-4 8-8 12-16 12h-28c-6 0-8-6-4-14 4-10 6-20 10-28Z" fill="#F6F0DE" />
        <g fill="#1B2616">
          <ellipse cx="28" cy="292" rx="46" ry="26" />
          <ellipse cx="86" cy="304" rx="38" ry="20" />
          <ellipse cx="154" cy="296" rx="52" ry="28" />
          <ellipse cx="404" cy="292" rx="58" ry="30" />
          <ellipse cx="462" cy="304" rx="36" ry="22" />
          <path d="M8 274c8-24 16-24 24 0M40 266c10-30 20-28 30 2M128 262c12-34 22-32 34 4M372 260c14-36 26-34 40 4" />
        </g>
      </svg>
      <img className="passport-mark" src="/brand/logos/venturo-horizontal-dark.svg" alt="" />
      <Stamp complete={complete} />
    </div>
  );
}

function Stamp({ complete }: { complete: boolean }) {
  const label = complete ? "ADVENTURE COMPLETE" : "LET'S GET OUT THERE";
  return (
    <svg className="passport-stamp" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r="62" fill="none" stroke="#2A2D35" strokeWidth="3" />
      <circle cx="70" cy="70" r="54" fill="none" stroke="#2A2D35" strokeWidth="1.4" strokeDasharray="2 3" />
      <defs>
        <path id="passport-stamp-ring" d="M70 70 m-46 0 a46 46 0 1 1 92 0 a46 46 0 1 1 -92 0" />
      </defs>
      <text fill="#2A2D35" fontSize="8" fontFamily="Nunito, Trebuchet MS, sans-serif" letterSpacing="1.2">
        <textPath href="#passport-stamp-ring" startOffset="50%" textAnchor="middle">
          {label}
        </textPath>
      </text>
      <path d="M48 78 70 52l22 26h-12v16H60V78Z" fill="#2A2D35" />
      {complete ? <path d="M62 84l6 6 12-14" fill="none" stroke="#F6F0DE" strokeWidth="3" strokeLinecap="round" /> : null}
    </svg>
  );
}
