import { Resvg } from "@resvg/resvg-js";

interface TribunalOgOptions {
  eyebrow?: string;
  title: string;
  scoreLine?: string;
  rankLabel?: string;
  rankTone?: "gold" | "red";
  footer?: string;
}

const width = 1200;
const height = 630;

export function resultRank(score: number) {
  if (score >= 9)
    return { label: "Honored Adjudicator", tone: "gold" as const };
  if (score >= 7) return { label: "Sound Judgment", tone: "gold" as const };
  if (score >= 5) return { label: "Under Review", tone: "red" as const };
  return { label: "Recused", tone: "red" as const };
}

export function renderTribunalOgPng(options: TribunalOgOptions) {
  const svg = renderTribunalOgSvg(options);
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: width,
    },
    font: {
      loadSystemFonts: true,
      defaultFontFamily: "DejaVu Serif",
    },
  });
  return resvg.render().asPng();
}

function renderTribunalOgSvg(options: TribunalOgOptions) {
  const rankTone = options.rankTone || "gold";
  const stampColor = rankTone === "gold" ? "#c9a45c" : "#e05545";
  const stampShadow =
    rankTone === "gold" ? "rgba(201,164,92,.28)" : "rgba(224,85,69,.24)";
  const scoreLine =
    options.scoreLine || "10 code exhibits. No hints. Seal your ruling.";
  const rankLabel = options.rankLabel || "Public Record";
  const footer =
    options.footer || "Exhibits remain sealed on published records.";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="goldGlow" cx="50%" cy="-10%" r="75%">
      <stop offset="0%" stop-color="#c9a45c" stop-opacity=".18"/>
      <stop offset="58%" stop-color="#c9a45c" stop-opacity=".035"/>
      <stop offset="100%" stop-color="#0e0d0b" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sealGlow" cx="42%" cy="32%" r="78%">
      <stop offset="0%" stop-color="#d95a4b"/>
      <stop offset="55%" stop-color="#a03030"/>
      <stop offset="100%" stop-color="#5a1713"/>
    </radialGradient>
    <filter id="paperShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000000" flood-opacity=".34"/>
    </filter>
    <filter id="stampShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="0" stdDeviation="13" flood-color="${stampShadow}" flood-opacity="1"/>
    </filter>
    <style>
      .serif { font-family: Georgia, "DejaVu Serif", serif; }
      .mono { font-family: "DejaVu Sans Mono", "Courier New", monospace; }
      .rule { stroke: rgba(237,228,208,.18); stroke-width: 1; }
      .gold { fill: #c9a45c; }
      .parchment { fill: #ede4d0; }
      .dim { fill: #a89c85; }
      .ink { fill: #0e0d0b; }
    </style>
  </defs>

  <rect width="${width}" height="${height}" fill="#0e0d0b"/>
  <rect width="${width}" height="${height}" fill="url(#goldGlow)"/>
  <rect x="52" y="48" width="1096" height="534" rx="3" fill="#16140f" stroke="rgba(237,228,208,.14)" filter="url(#paperShadow)"/>
  <line x1="96" y1="112" x2="1104" y2="112" class="rule"/>
  <line x1="96" y1="116" x2="1104" y2="116" class="rule"/>
  <line x1="96" y1="514" x2="1104" y2="514" class="rule"/>
  <line x1="96" y1="518" x2="1104" y2="518" class="rule"/>

  <text x="600" y="158" text-anchor="middle" class="serif parchment" font-size="44" font-weight="700" letter-spacing="14">THE AUTHORSHIP TRIBUNAL</text>
  <text x="600" y="196" text-anchor="middle" class="serif dim" font-size="21" font-style="italic">manu aut machina — by hand, or by machine</text>

  <text x="112" y="262" class="mono gold" font-size="16" letter-spacing="7">${escapeSvg(options.eyebrow || "SEALED COURT RECORD")}</text>
  <text x="112" y="336" class="serif parchment" font-size="64" font-weight="800">${escapeSvg(options.title)}</text>
  <text x="112" y="392" class="serif dim" font-size="30" font-style="italic">${escapeSvg(scoreLine)}</text>

  <g transform="translate(828 256) rotate(-8)" filter="url(#stampShadow)">
    <rect x="-8" y="-52" width="286" height="104" rx="3" fill="none" stroke="${stampColor}" stroke-width="6"/>
    <rect x="5" y="-39" width="260" height="78" rx="2" fill="none" stroke="${stampColor}" stroke-width="2" opacity=".75"/>
    <text x="135" y="-8" text-anchor="middle" class="mono" fill="${stampColor}" font-size="24" font-weight="800" letter-spacing="3">${escapeSvg(rankLabel.toUpperCase())}</text>
    <text x="135" y="25" text-anchor="middle" class="mono" fill="${stampColor}" font-size="14" letter-spacing="5">VERDICT STAMP</text>
  </g>

  <g transform="translate(932 382)">
    <path d="M88 9 C119 6 148 23 158 48 C169 74 166 111 156 135 C145 160 118 176 88 174 C57 172 28 160 17 135 C6 109 9 75 21 49 C34 24 57 13 88 9 Z" fill="url(#sealGlow)" stroke="rgba(14,13,11,.48)" stroke-width="2"/>
    <circle cx="88" cy="91" r="53" fill="none" stroke="rgba(237,228,208,.18)" stroke-width="2" stroke-dasharray="5 6"/>
    <text x="88" y="102" text-anchor="middle" class="mono" fill="rgba(237,228,208,.72)" font-size="28" font-weight="700" letter-spacing="4"></text>
  </g>

  <text x="112" y="552" class="mono dim" font-size="17" letter-spacing="4">${escapeSvg(footer)}</text>
</svg>`;
}

function escapeSvg(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
