import Image from "next/image";

// Deterministic little PRNG so the same menu item always renders the same
// "photo" — no randomness flicker between server/client renders.
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Coordinates are rounded to 2 decimals: raw floats stringify differently
// between Node and the browser, which trips React hydration.
const round2 = (n: number) => Math.round(n * 100) / 100;

interface PizzaArtProps {
  isVeg?: boolean | null;
  seed: string;
  size?: number;
  imageUrl?: string;
  className?: string;
}

interface Placed {
  cx: number;
  cy: number;
  r: number;
}

// Golden-angle placement with jitter keeps toppings spread out instead of
// clumping, while staying fully deterministic per seed.
function placeToppings(rand: () => number, count: number, minR: number, maxR: number): Placed[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = i * 2.39996 + rand() * 0.9;
    const dist = 5 + (i % 3) * 5 + rand() * 4; // rings at ~5/10/15 + jitter
    return {
      cx: round2(32 + Math.cos(angle) * dist),
      cy: round2(32 + Math.sin(angle) * dist),
      r: round2(minR + rand() * (maxR - minR)),
    };
  });
}

// Illustrated stand-in for product photography: baked crust, melted cheese,
// slice cuts, and real-looking toppings (pepperoni vs. veg mix). Swap in a
// real photo later by passing `imageUrl` — everything else (sizing, rounding,
// veg/non-veg treatment) stays identical.
export function PizzaArt({ isVeg, seed, size = 64, imageUrl, className = "" }: PizzaArtProps) {
  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt=""
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const rand = mulberry32(hashSeed(seed));
  const uid = `pz-${seed.replace(/[^a-zA-Z0-9]/g, "")}`;
  const nonVeg = isVeg === false;

  // Charred blisters along the crust rim.
  const crustSpots = Array.from({ length: 7 }, () => {
    const a = rand() * Math.PI * 2;
    return {
      cx: round2(32 + Math.cos(a) * 28),
      cy: round2(32 + Math.sin(a) * 28),
      r: round2(1 + rand() * 1.3),
    };
  });

  // Lighter blobs of bubbled, melted cheese.
  const cheeseBlobs = Array.from({ length: 6 }, () => {
    const a = rand() * Math.PI * 2;
    const d = rand() * 16;
    return {
      cx: round2(32 + Math.cos(a) * d),
      cy: round2(32 + Math.sin(a) * d),
      rx: round2(2.5 + rand() * 3),
      ry: round2(1.8 + rand() * 2),
    };
  });

  // Slice cuts: three faint diameters (6 slices), rotated per pizza.
  const sliceBase = rand() * Math.PI;
  const cuts = [0, 1, 2].map((k) => {
    const a = sliceBase + (k * Math.PI) / 3;
    return {
      x1: round2(32 + Math.cos(a) * 24),
      y1: round2(32 + Math.sin(a) * 24),
      x2: round2(32 - Math.cos(a) * 24),
      y2: round2(32 - Math.sin(a) * 24),
    };
  });

  const toppings = nonVeg
    ? placeToppings(rand, 6 + Math.floor(rand() * 2), 3.4, 4.4)
    : placeToppings(rand, 7 + Math.floor(rand() * 3), 2.4, 3.2);

  // Tiny herb flecks scattered over the cheese.
  const herbs = Array.from({ length: 8 }, () => {
    const a = rand() * Math.PI * 2;
    const d = rand() * 19;
    return {
      x: round2(32 + Math.cos(a) * d),
      y: round2(32 + Math.sin(a) * d),
      rot: Math.round(rand() * 180),
    };
  });

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`${uid}-crust`} cx="38%" cy="32%" r="72%">
          <stop offset="0%" stopColor="#f3c473" />
          <stop offset="62%" stopColor="#e3a04a" />
          <stop offset="88%" stopColor="#c97e2c" />
          <stop offset="100%" stopColor="#a85f1d" />
        </radialGradient>
        <radialGradient id={`${uid}-cheese`} cx="40%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#fce9a8" />
          <stop offset="55%" stopColor="#f7cf6b" />
          <stop offset="100%" stopColor="#eaa83c" />
        </radialGradient>
        <radialGradient id={`${uid}-shine`} cx="34%" cy="26%" r="55%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* soft drop shadow so it sits on the card */}
      <ellipse cx="32" cy="34.5" rx="30" ry="28.5" fill="#7c2d12" opacity="0.18" />

      {/* crust */}
      <circle cx="32" cy="32" r="30" fill={`url(#${uid}-crust)`} />
      <circle cx="32" cy="32" r="30" fill="none" stroke="#8a4b16" strokeOpacity="0.45" strokeWidth="1" />
      {crustSpots.map((s, i) => (
        <circle key={`c${i}`} cx={s.cx} cy={s.cy} r={s.r} fill="#8a4b16" opacity="0.45" />
      ))}

      {/* sauce ring peeking out from under the cheese */}
      <circle cx="32" cy="32" r="24.5" fill="#c2410c" />

      {/* cheese */}
      <circle cx="32" cy="32" r="23" fill={`url(#${uid}-cheese)`} />
      {cheeseBlobs.map((b, i) => (
        <ellipse key={`b${i}`} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fill="#fdf0c2" opacity="0.5" />
      ))}

      {/* slice cuts (under the toppings, like a cut pizza) */}
      {cuts.map((l, i) => (
        <line key={`l${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#b45309" strokeOpacity="0.22" strokeWidth="0.8" />
      ))}

      {/* toppings */}
      {nonVeg
        ? toppings.map((t, i) => (
            <g key={`t${i}`}>
              {/* pepperoni: meat disc, darker rim, fat specks */}
              <circle cx={t.cx} cy={t.cy} r={t.r} fill="#d33b2f" stroke="#a32418" strokeWidth="0.8" />
              <circle cx={round2(t.cx - t.r * 0.3)} cy={round2(t.cy - t.r * 0.25)} r={round2(t.r * 0.18)} fill="#f2a08c" opacity="0.9" />
              <circle cx={round2(t.cx + t.r * 0.32)} cy={round2(t.cy + t.r * 0.3)} r={round2(t.r * 0.14)} fill="#f2a08c" opacity="0.8" />
            </g>
          ))
        : toppings.map((t, i) =>
            i % 3 === 0 ? (
              // capsicum ring
              <circle key={`t${i}`} cx={t.cx} cy={t.cy} r={t.r} fill="none" stroke="#3f9142" strokeWidth="1.5" opacity="0.95" />
            ) : i % 3 === 1 ? (
              // olive slice
              <g key={`t${i}`}>
                <circle cx={t.cx} cy={t.cy} r={round2(t.r * 0.8)} fill="#4a4536" />
                <circle cx={t.cx} cy={t.cy} r={round2(t.r * 0.3)} fill="#f7cf6b" />
              </g>
            ) : (
              // cherry-tomato half
              <g key={`t${i}`}>
                <circle cx={t.cx} cy={t.cy} r={round2(t.r * 0.85)} fill="#e2513c" stroke="#b93a28" strokeWidth="0.7" />
                <circle cx={round2(t.cx - t.r * 0.2)} cy={round2(t.cy - t.r * 0.2)} r={round2(t.r * 0.22)} fill="#f59f8d" opacity="0.85" />
              </g>
            ),
          )}

      {/* herb flecks */}
      {herbs.map((h, i) => (
        <rect
          key={`h${i}`}
          x={round2(h.x - 0.9)}
          y={round2(h.y - 0.35)}
          width="1.8"
          height="0.7"
          rx="0.35"
          fill="#2f7a35"
          opacity="0.85"
          transform={`rotate(${h.rot} ${h.x} ${h.y})`}
        />
      ))}

      {/* glossy highlight so the cheese reads as melted */}
      <circle cx="32" cy="32" r="23" fill={`url(#${uid}-shine)`} />
    </svg>
  );
}

// Brand logomark used in the header/footer/login — replaces the plain 🍕 emoji.
export function PizzaMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className={className} aria-hidden="true">
      <defs>
        <linearGradient id="pm-slice" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
      </defs>
      <path d="M16 3 L29 27 A16 16 0 0 1 3 27 Z" fill="url(#pm-slice)" />
      <path d="M16 3 L29 27 A16 16 0 0 1 3 27 Z" fill="none" stroke="#fff7ed" strokeOpacity="0.5" strokeWidth="1" />
      <circle cx="16" cy="15" r="1.8" fill="#fff7ed" />
      <circle cx="12" cy="20" r="1.4" fill="#fff7ed" />
      <circle cx="20" cy="21" r="1.5" fill="#fff7ed" />
      <circle cx="16" cy="25" r="1.3" fill="#fff7ed" />
    </svg>
  );
}
