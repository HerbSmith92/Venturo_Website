export function PassportScene({
  complete,
  imageUrl,
}: {
  complete: boolean;
  imageUrl: string;
}) {
  return (
    <div className="passport-art">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="passport-scene" src={imageUrl} alt="" />
      <img className="passport-mark" src="/brand/logos/venturo-horizontal-light.svg" alt="" />
      <Stamp complete={complete} />
    </div>
  );
}

function Stamp({ complete }: { complete: boolean }) {
  const label = complete ? "ADVENTURE COMPLETE" : "LET'S GET OUT THERE";
  return (
    <svg className="passport-stamp" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r="64" fill="#EBEBF3" fillOpacity="0.92" />
      <circle cx="70" cy="70" r="58" fill="none" stroke="#2A2D35" strokeWidth="3" />
      <circle cx="70" cy="70" r="50" fill="none" stroke="#2A2D35" strokeWidth="1.4" strokeDasharray="2 3" />
      <defs>
        <path id="passport-stamp-ring" d="M70 70 m-42 0 a42 42 0 1 1 84 0 a42 42 0 1 1 -84 0" />
      </defs>
      <text fill="#2A2D35" fontSize="8" fontFamily="Nunito, Trebuchet MS, sans-serif" letterSpacing="1.1">
        <textPath href="#passport-stamp-ring" startOffset="50%" textAnchor="middle">
          {label}
        </textPath>
      </text>
      <path d="M50 78 70 54l20 24h-11v14H61V78Z" fill="#2A2D35" />
      {complete ? (
        <path d="M63 82l5 5 11-13" fill="none" stroke="#EBEBF3" strokeWidth="3" strokeLinecap="round" />
      ) : null}
    </svg>
  );
}
