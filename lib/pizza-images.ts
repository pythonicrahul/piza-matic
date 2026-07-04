// Curated pizza photography (Unsplash CDN, all URLs verified live).
// Menu items get a photo by name keyword first, then a stable hash pick from
// the pool — so the same pizza always shows the same photo, with no DB column
// needed. When you later add an `image_url` column to `menu_items`, pass it
// straight through to <PizzaPhoto imageUrl={...}> and this mapping is bypassed.

const U = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

export const HERO_PIZZA_IMAGE = U("photo-1513104890138-7c749659a591", 1400);

// Every photo below was downloaded and visually verified — the comment says
// what the picture actually shows, so the keyword map stays truthful.
const POOL = [
  U("photo-1574071318508-1cdbab80d002"), // neapolitan margherita, basil, marble table
  U("photo-1534308983496-4fabb1a015ee"), // classic pepperoni in delivery box
  U("photo-1565299624946-b28f40a0ae38"), // bbq chicken w/ onion & cilantro, dark board
  U("photo-1552539618-7eec9b4d1796"),    // loaded veggie supreme: corn, olives, peppers
  U("photo-1594007654729-407eedc4be65"), // diced chicken/tomato chunks on wheat crust
  U("photo-1620374645498-af6bd681a0bd"), // paneer-style pale cubes on cheesy round
  U("photo-1574126154517-d1e0d89ef734"), // deep-pan veggie, dramatic cheese pull
  U("photo-1571407970349-bc81e7e96d47"), // loaded pizza + dips + cola, hands grabbing
  U("photo-1585238342024-78d387f4a707"), // thin crust, tomato slices + olives + basil
  U("photo-1628840042765-356cda07504e"), // ham + pepperoni meat-loaded round
  U("photo-1541745537411-b8046dc6d66c"), // cheese-pull slice lift, pepperoni pan
  U("photo-1604382354936-07c5d9983bd3"), // colourful supreme w/ mushroom & olives
  U("photo-1600028068383-ea11a7a101f3"), // cherry tomato + mozzarella slice pull
  U("photo-1513104890138-7c749659a591"), // rustic cheese pizza, rosemary, moody light
];

// Keyword → photo, tuned to the seeded SliceMatic menu names. The photo must
// show what the name promises: paneer names show paneer-style cubes, chicken
// names show chicken pieces, veggie names show loaded vegetables.
// Order matters: more specific patterns (paneer, bbq) come before broader ones.
const KEYWORD_MAP: [RegExp, string][] = [
  [/margherita/i, U("photo-1574071318508-1cdbab80d002")],
  [/pepperoni/i, U("photo-1534308983496-4fabb1a015ee")],
  [/paneer/i, U("photo-1620374645498-af6bd681a0bd")],
  [/bbq|barbecue/i, U("photo-1565299624946-b28f40a0ae38")],
  [/chicken|tikka/i, U("photo-1594007654729-407eedc4be65")],
  [/farmhouse|veggie|garden|supreme/i, U("photo-1552539618-7eec9b4d1796")],
  [/spinach|greens/i, U("photo-1593560708920-61dd98c46a4e")],
  [/cheese|burst/i, U("photo-1541745537411-b8046dc6d66c")],
  [/mushroom|olive/i, U("photo-1604382354936-07c5d9983bd3")],
  [/corn|pan|deep/i, U("photo-1574126154517-d1e0d89ef734")],
  [/hawaiian|pineapple/i, U("photo-1565299624946-b28f40a0ae38")],
  [/meat|ham|sausage/i, U("photo-1628840042765-356cda07504e")],
  [/tomato|basil|fresh/i, U("photo-1600028068383-ea11a7a101f3")],
];

// Base (crust) → photo: the picture shows the crust style itself.
const BASE_MAP: [RegExp, string][] = [
  [/thin/i, U("photo-1585238342024-78d387f4a707", 400)],       // visibly thin, crisp crust
  [/cheese|burst|stuffed/i, U("photo-1541745537411-b8046dc6d66c", 400)], // molten cheese pull
  [/wheat|whole|multigrain/i, U("photo-1509440159596-0249088772ff", 400)], // whole-grain loaves + wheat stalks
  [/pan|deep|thick/i, U("photo-1574126154517-d1e0d89ef734", 400)], // thick pan crust
];
const BASE_FALLBACK = U("photo-1513104890138-7c749659a591", 400); // rustic baked crust

export function baseImageFor(name: string): string {
  for (const [re, url] of BASE_MAP) {
    if (re.test(name)) return url;
  }
  return BASE_FALLBACK;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pizzaImageFor(name: string, seed: string): string {
  for (const [re, url] of KEYWORD_MAP) {
    if (re.test(name)) return url;
  }
  return POOL[hashString(seed) % POOL.length];
}
