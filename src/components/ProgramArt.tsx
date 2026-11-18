/**
 * Illustrations for programme cards that have no photo: road signs for theory, a loading dock for
 * the truck yard, a truck in the city. Drawn in the logo's colours so they sit in the site's style.
 */
export type ArtVariant = "signs-b" | "signs-c" | "dock" | "truck-city";

const RED = "#d6192b";
const CORAL = "#ff6b52";
const INK = "#101712";

function Truck({
  x,
  y,
  s = 1,
  body = "#f4f5f0",
  flip = false,
}: {
  x: number;
  y: number;
  s?: number;
  body?: string;
  flip?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <rect x="0" y="-52" width="104" height="52" rx="6" fill={body} />
      <rect
        x="0"
        y="-52"
        width="104"
        height="8"
        rx="4"
        fill={RED}
        opacity=".9"
      />
      <path d="M108 -34h24q8 0 12 8l8 14q2 4 2 8v12h-46z" fill={body} />
      <path d="M114 -30h16q4 0 6 4l6 10h-28z" fill="#243029" />
      <rect x="-2" y="-4" width="150" height="10" rx="3" fill="#1c2420" />
      <circle cx="26" cy="8" r="13" fill="#1c2420" />
      <circle cx="26" cy="8" r="5.5" fill="#8d958f" />
      <circle cx="66" cy="8" r="13" fill="#1c2420" />
      <circle cx="66" cy="8" r="5.5" fill="#8d958f" />
      <circle cx="124" cy="8" r="13" fill="#1c2420" />
      <circle cx="124" cy="8" r="5.5" fill="#8d958f" />
      <rect x="140" y="-14" width="10" height="6" rx="2" fill={CORAL} />
    </g>
  );
}

function Signs({ truck }: { truck: boolean }) {
  return (
    <>
      <g className="art-float a1" transform="translate(84 138) rotate(-12)">
        <path
          d="M0 -50 L54 42 L-54 42 Z"
          fill="#fff"
          stroke={RED}
          strokeWidth="11"
          strokeLinejoin="round"
        />
        <rect x="-4.5" y="-18" width="9" height="34" rx="4" fill={INK} />
        <circle cx="0" cy="27" r="5.5" fill={INK} />
      </g>
      <g className="art-float a2" transform="translate(316 150) rotate(10)">
        <path
          d="M20 -49 L49 -20 L49 20 L20 49 L-20 49 L-49 20 L-49 -20 L-20 -49 Z"
          fill={RED}
          stroke="#fff"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
        <text
          x="0"
          y="8"
          textAnchor="middle"
          fontSize="23"
          fontWeight="800"
          fill="#fff"
          fontFamily="Inter, Arial, sans-serif"
          letterSpacing="1"
        >
          STOP
        </text>
      </g>
      <g className="art-float a3" transform="translate(200 112)">
        <circle r="66" fill="#fff" />
        {truck ? (
          <>
            <circle r="66" fill="#1f5fa8" />
            <circle r="57" fill="none" stroke="#fff" strokeWidth="4" />
            <g transform="translate(-34 16) scale(.46)">
              <rect x="0" y="-52" width="104" height="52" rx="6" fill="#fff" />
              <path d="M108 -34h24q8 0 12 8l8 14q2 4 2 8v12h-46z" fill="#fff" />
              <circle
                cx="26"
                cy="8"
                r="13"
                fill="#fff"
                stroke="#1f5fa8"
                strokeWidth="5"
              />
              <circle
                cx="66"
                cy="8"
                r="13"
                fill="#fff"
                stroke="#1f5fa8"
                strokeWidth="5"
              />
              <circle
                cx="124"
                cy="8"
                r="13"
                fill="#fff"
                stroke="#1f5fa8"
                strokeWidth="5"
              />
            </g>
          </>
        ) : (
          <>
            <circle r="66" fill={RED} />
            <circle r="52" fill="#fff" />
            <text
              x="0"
              y="19"
              textAnchor="middle"
              fontSize="56"
              fontWeight="800"
              fill={INK}
              fontFamily="Inter, Arial, sans-serif"
            >
              60
            </text>
          </>
        )}
      </g>
      <g transform="translate(354 52)">
        <circle r="19" fill={CORAL} />
        <path
          d="M-8 1l5.5 6 11-12"
          fill="none"
          stroke={INK}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </>
  );
}

function Dock() {
  return (
    <>
      <rect x="248" y="96" width="140" height="104" rx="6" fill="#1c2420" />
      <rect x="248" y="96" width="140" height="12" fill={RED} opacity=".9" />
      <rect x="276" y="122" width="84" height="78" rx="3" fill="#0b100c" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect
          key={i}
          x={276}
          y={128 + i * 12}
          width="84"
          height="3"
          fill="#2a352e"
        />
      ))}
      <rect x="240" y="150" width="10" height="50" rx="3" fill={CORAL} />
      <path d="M0 200 H400" stroke="#3a463e" strokeWidth="3" />
      <path
        d="M96 214 C150 238 206 232 236 206"
        fill="none"
        stroke="#fff"
        strokeOpacity=".7"
        strokeWidth="3.5"
        strokeDasharray="2 9"
        strokeLinecap="round"
      />
      <path d="M232 200 l11 3 -8 8z" fill="#fff" fillOpacity=".85" />
      <Truck x={226} y={176} s={0.92} flip />
      {[0, 1].map((i) => (
        <g key={i} transform={`translate(${i ? 66 : 236} 200)`}>
          <path d="M-9 0 L-3 -26 L3 -26 L9 0 Z" fill={CORAL} />
          <rect x="-7" y="-17" width="14" height="4" fill="#fff" />
          <rect x="-11" y="-2" width="22" height="4" rx="2" fill="#1c2420" />
        </g>
      ))}
    </>
  );
}

function TruckCity() {
  const towers: [number, number, number][] = [
    [8, 86, 52],
    [64, 60, 46],
    [114, 100, 40],
    [158, 72, 58],
    [220, 112, 44],
    [268, 66, 50],
    [322, 94, 56],
  ];
  return (
    <>
      {towers.map(([x, h, w], i) => (
        <g key={i}>
          <rect x={x} y={200 - h} width={w} height={h} rx="3" fill="#18211b" />
          {Array.from({ length: Math.floor(h / 22) }).map((_, r) =>
            [0, 1].map((c) => (
              <rect
                key={`${r}-${c}`}
                x={x + 9 + c * ((w - 24) / 1)}
                y={200 - h + 10 + r * 22}
                width="9"
                height="9"
                rx="1.5"
                fill={(i + r + c) % 4 === 0 ? CORAL : "#2c3a31"}
                opacity={(i + r + c) % 4 === 0 ? 0.9 : 1}
              />
            )),
          )}
        </g>
      ))}
      <rect x="0" y="200" width="400" height="50" fill="#0b100c" />
      <path
        d="M0 226 H400"
        stroke="#fff"
        strokeOpacity=".5"
        strokeWidth="3"
        strokeDasharray="22 16"
      />
      <Truck x={116} y={206} s={0.98} />
      <g transform="translate(366 188)">
        <rect x="-3" y="-66" width="6" height="66" fill="#3a463e" />
        <rect
          x="-11"
          y="-92"
          width="22"
          height="46"
          rx="6"
          fill="#0b100c"
          stroke="#3a463e"
          strokeWidth="2"
        />
        <circle cy="-82" r="5" fill="#3a1a1a" />
        <circle cy="-69" r="5" fill="#3a2f12" />
        <circle cy="-56" r="5.5" fill="#6ff59a" />
      </g>
    </>
  );
}

export default function ProgramArt({ variant }: { variant: ArtVariant }) {
  return (
    <svg
      className="program-art"
      viewBox="0 0 400 250"
      role="img"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id={"pa-bg-" + variant} cx="30%" cy="15%" r="95%">
          <stop offset="0" stopColor="#2c4636" />
          <stop offset=".55" stopColor="#141c16" />
          <stop offset="1" stopColor="#090d0a" />
        </radialGradient>
        <filter
          id={"pa-sh-" + variant}
          x="-20%"
          y="-20%"
          width="140%"
          height="150%"
        >
          <feDropShadow
            dx="0"
            dy="6"
            stdDeviation="7"
            floodColor="#000"
            floodOpacity=".45"
          />
        </filter>
      </defs>
      <rect width="400" height="250" fill={`url(#pa-bg-${variant})`} />
      {/* the logo's road swoosh */}
      <path
        d="M-20 238 C110 176 290 172 424 226"
        fill="none"
        stroke="#fff"
        strokeOpacity=".16"
        strokeWidth="3"
      />
      <path
        d="M-20 252 C120 190 292 186 424 244"
        fill="none"
        stroke={RED}
        strokeOpacity=".55"
        strokeWidth="5"
      />
      <g filter={`url(#pa-sh-${variant})`}>
        {variant === "signs-b" && <Signs truck={false} />}
        {variant === "signs-c" && <Signs truck />}
        {variant === "dock" && <Dock />}
        {variant === "truck-city" && <TruckCity />}
      </g>
    </svg>
  );
}
