/**
 * Door handing reference data with SVG diagram generators.
 * Shows all 4 standard handing types with top-down views.
 */

export interface HandingInfo {
  code: string;
  name: string;
  description: string;
  hinges: "left" | "right";
  swing: "push" | "pull";
  common: string;
}

export const HANDING_TYPES: HandingInfo[] = [
  {
    code: "LH",
    name: "Left Hand",
    description: "Hinges are on the left side of the door. The door swings away from you (push). Also known as 'Left Handed' or 'Left Hand Swing Out'.",
    hinges: "left",
    swing: "push",
    common: "Standard left-handed doors. Common on bedroom and bathroom doors where the door pushes into the room.",
  },
  {
    code: "RH",
    name: "Right Hand",
    description: "Hinges are on the right side of the door. The door swings away from you (push). Also known as 'Right Handed' or 'Right Hand Swing Out'.",
    hinges: "right",
    swing: "push",
    common: "Standard right-handed doors. Common on closet and hallway doors where the door pushes into the room.",
  },
  {
    code: "LHR",
    name: "Left Hand Reverse",
    description: "Hinges are on the left side of the door. The door swings toward you (pull). Also known as 'Left Handed Reverse Bevel' or 'Left Hand Swing In'.",
    hinges: "left",
    swing: "pull",
    common: "Reverse left-handed doors. Common on exterior doors and entryways where the door pulls into the building.",
  },
  {
    code: "RHR",
    name: "Right Hand Reverse",
    description: "Hinges are on the right side of the door. The door swings toward you (pull). Also known as 'Right Handed Reverse Bevel' or 'Right Hand Swing In'.",
    hinges: "right",
    swing: "pull",
    common: "Reverse right-handed doors. Common on exterior doors and entryways where the door pulls into the building.",
  },
];

/**
 * Generate an SVG diagram for a door handing type.
 * Shows a top-down view with door frame, door, hinges, and swing direction.
 */
export function renderHandingDiagram(h: HandingInfo): string {
  const w = 380;
  const h2 = 280;
  const midX = w / 2;
  const midY = h2 / 2;

  // Door frame dimensions
  const frameW = 200;
  const frameD = 20; // depth/thickness of frame
  const doorW = 170;
  const doorD = 16;
  const hingeY = 60;

  // Position the door assembly centered
  const frameX = midX - frameW / 2;
  const frameY = midY - frameD / 2;
  const doorX = frameX + frameD;

  // Determine hinge side and swing direction
  const hingesOnLeft = h.hinges === "left";
  const isPush = h.swing === "push";

  // Hinge position (left or right side of frame)
  const hingeX = hingesOnLeft ? frameX : frameX + frameW - frameD;

  // Door position: if push, door is flush with outer frame; if pull, door is flush with inner frame
  const doorOffset = isPush ? 0 : frameD - doorD;
  const doorPosX = hingesOnLeft ? frameX + frameD - doorOffset : frameX + frameW - frameD - doorW + doorOffset;

  // Swing arc center
  const arcCX = doorPosX + (hingesOnLeft ? 0 : doorW);
  const arcCY = midY + 40;
  const arcR = 50;

  const outline = "#333";
  const fill = "#f0f0f0";
  const frameFill = "#ddd";
  const hingeFill = "#999";
  const arrowColor = "#d32f2f";
  const textColor = "#555";
  const mutedText = "#999";

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h2}" width="100%" height="100%">`;

  // ── Door frame (3 sides) ──
  // Top frame
  svg += `<rect x="${frameX}" y="${frameY}" width="${frameW}" height="${frameD}" rx="2" fill="${frameFill}" stroke="${outline}" stroke-width="1.5"/>`;
  // Bottom frame
  svg += `<rect x="${frameX}" y="${frameY + 100}" width="${frameW}" height="${frameD}" rx="2" fill="${frameFill}" stroke="${outline}" stroke-width="1.5"/>`;
  // Hinge-side frame
  svg += `<rect x="${frameX}" y="${frameY}" width="${frameD}" height="${frameD + 100}" rx="2" fill="${frameFill}" stroke="${outline}" stroke-width="1.5"/>`;
  // Opposite side frame (thin strike plate side)
  const oppX = hingesOnLeft ? frameX + frameW - frameD : frameX;
  svg += `<rect x="${oppX}" y="${frameY}" width="${frameD}" height="${frameD + 100}" rx="2" fill="${frameFill}" stroke="${outline}" stroke-width="1.5"/>`;

  // ── Door ──
  svg += `<rect x="${doorPosX}" y="${frameY + 2}" width="${doorW}" height="${frameD + 96}" rx="2" fill="white" stroke="${outline}" stroke-width="2"/>`;
  // Door center line
  svg += `<line x1="${doorPosX + doorW / 2}" y1="${frameY + 4}" x2="${doorPosX + doorW / 2}" y2="${frameY + frameD + 96}" stroke="${mutedText}" stroke-width="0.5" stroke-dasharray="3,3"/>`;

  // ── Hinges ──
  for (let i = 0; i < 3; i++) {
    const hy = frameY + 15 + i * 32;
    const hx = hingesOnLeft ? hingeX + frameD / 2 - 4 : hingeX + frameD / 2 - 4;
    svg += `<rect x="${hx}" y="${hy}" width="8" height="6" rx="1" fill="${hingeFill}" stroke="${outline}" stroke-width="1"/>`;
  }

  // ── Swing arc + arrow ──
  // Draw the arc
  const startAngle = hingesOnLeft ? (isPush ? -90 : 90) : (isPush ? 90 : -90);
  const endAngle = isPush ? 0 : 180;
  const largeArc = 0;
  const sweepFlag = (hingesOnLeft && !isPush) || (!hingesOnLeft && isPush) ? 1 : 0;

  // Arc center relative to hinge side
  const arcCenterX = hingesOnLeft ? doorPosX : doorPosX + doorW;
  const arcCenterY = midY + 40;

  // Calculate arc end points
  const rad = isPush ? 0 : Math.PI;
  const arcEndX = arcCenterX + arcR * Math.cos(rad);
  const arcEndY = arcCenterY + arcR * Math.sin(rad);
  const arcStartX = arcCenterX + arcR * Math.cos(hingesOnLeft ? -Math.PI / 2 : Math.PI / 2);
  const arcStartY = arcCenterY + arcR * Math.sin(hingesOnLeft ? -Math.PI / 2 : Math.PI / 2);

  // Draw the arc
  svg += `<path d="M${arcStartX},${arcStartY} A${arcR},${arcR} 0 0,${sweepFlag} ${arcEndX},${arcEndY}" fill="none" stroke="${arrowColor}" stroke-width="2" stroke-dasharray="6,3"/>`;

  // Arrowhead at end
  const arrowAngle = isPush ? 0 : Math.PI;
  const ax = arcEndX;
  const ay = arcEndY;
  const aSize = 8;
  svg += `<polygon points="${ax},${ay} ${ax - aSize * Math.cos(arrowAngle - 0.4)},${ay - aSize * Math.sin(arrowAngle - 0.4)} ${ax - aSize * Math.cos(arrowAngle + 0.4)},${ay - aSize * Math.sin(arrowAngle + 0.4)}" fill="${arrowColor}"/>`;

  // ── Labels ──
  // Handing code (large)
  svg += `<text x="${midX}" y="${frameY - 15}" text-anchor="middle" font-size="18" fill="${outline}" font-family="Arial, sans-serif" font-weight="bold">${h.code} — ${h.name}</text>`;

  // Hinge label
  const hingeLabelX = hingesOnLeft ? frameX - 35 : frameX + frameW + 35;
  svg += `<text x="${hingeLabelX}" y="${midY}" text-anchor="middle" font-size="11" fill="${textColor}" font-family="Arial, sans-serif" font-weight="bold">Hinges</text>`;
  svg += `<text x="${hingeLabelX}" y="${midY + 16}" text-anchor="middle" font-size="11" fill="${textColor}" font-family="Arial, sans-serif">on ${h.hinges === "left" ? "Left" : "Right"}</text>`;

  // Swing direction label
  const swingLabelX = hingesOnLeft ? frameX + frameW + 50 : frameX - 50;
  svg += `<text x="${swingLabelX}" y="${midY + 40}" text-anchor="middle" font-size="12" fill="${arrowColor}" font-family="Arial, sans-serif" font-weight="bold">${h.swing === "push" ? "PUSH" : "PULL"}</text>`;
  svg += `<text x="${swingLabelX}" y="${midY + 56}" text-anchor="middle" font-size="9" fill="${textColor}" font-family="Arial, sans-serif">Swing ${h.swing === "push" ? "Away" : "Toward"}</text>`;

  // Legend at bottom
  svg += `<text x="${midX}" y="${frameY + frameD + 125}" text-anchor="middle" font-size="10" fill="${mutedText}" font-family="Arial, sans-serif">Top-down view — standing outside, facing the door</text>`;

  svg += `</svg>`;
  return svg;
}