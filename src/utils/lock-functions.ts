/**
 * Lock function definitions with SVG diagram generators.
 * Each function has a code, name, description, and a lockType
 * that determines which hardware silhouette to render.
 *
 * SVG diagrams show a door cross-section from above with lever handles,
 * key cylinders, push buttons, thumb turns, etc. — like manufacturer spec sheets.
 */

export interface LockFunction {
  code: string;
  name: string;
  description: string;
  category: "commercial" | "residential" | "electric";
  /** Which lock hardware type to render */
  lockType: "cylindrical" | "exit-device" | "deadbolt" | "hotel" | "dummy" | "electric" | "passage" | "privacy";
  /** Hardware-specific detail flags */
  hasKeyOutside?: boolean;
  hasKeyInside?: boolean;
  hasPushButton?: boolean;
  hasThumbTurn?: boolean;
  hasEmergencyRelease?: boolean;
  hasDeadbolt?: boolean;
  hasKeycard?: boolean;
  isAlwaysLocked?: boolean;
  isAlwaysFree?: boolean;
  isElectrified?: boolean;
}

export const LOCK_FUNCTIONS: LockFunction[] = [
  // ── Commercial Functions ──
  {
    code: "F01",
    name: "Passage",
    category: "commercial",
    lockType: "passage",
    description: "Non-locking passage function. Both levers are always free to operate. No locking mechanism is present. Ideal for restrooms, corridors, and closets where privacy is not required.",
    isAlwaysFree: true,
  },
  {
    code: "F02",
    name: "Privacy",
    category: "commercial",
    lockType: "privacy",
    description: "Push-button privacy lock. Locked from inside by pushing a button. Emergency release on outside (slot or small tool). Used for restrooms, changing rooms, and private offices where a key is not required.",
    hasPushButton: true,
    hasEmergencyRelease: true,
  },
  {
    code: "F04",
    name: "Service Station",
    category: "commercial",
    lockType: "cylindrical",
    description: "Key outside, free inside. The outside lever is locked and requires a key to operate. The inside lever is always free for immediate egress. Used for service stations, utility rooms, and back-of-house areas.",
    hasKeyOutside: true,
    isAlwaysLocked: true,
  },
  {
    code: "F05",
    name: "Office",
    category: "commercial",
    lockType: "cylindrical",
    description: "Push-button locking with key override. The inside push-button locks the outside lever. A key outside can override the lock. Used for private offices, faculty rooms, and administrative areas.",
    hasKeyOutside: true,
    hasPushButton: true,
  },
  {
    code: "F07",
    name: "Classroom",
    category: "commercial",
    lockType: "cylindrical",
    description: "Key locks/unlocks outside lever. The outside lever is locked or unlocked by key from the outside. Inside lever is always free. Used for classrooms, lecture halls, and meeting rooms.",
    hasKeyOutside: true,
  },
  {
    code: "F08",
    name: "Storeroom",
    category: "commercial",
    lockType: "cylindrical",
    description: "Always locked outside, free inside. The outside lever is always locked and requires a key. The inside lever is always free for immediate egress. No key is needed to exit. Used for storage rooms, mechanical rooms, and electrical rooms.",
    hasKeyOutside: true,
    isAlwaysLocked: true,
  },
  {
    code: "F09",
    name: "Dormitory",
    category: "commercial",
    lockType: "cylindrical",
    description: "Key inside and outside with key override. Inside lever is free but has a key cylinder for locking. Outside requires key to operate. Used for dormitories, apartment buildings, and multi-tenant housing.",
    hasKeyOutside: true,
    hasKeyInside: true,
  },
  {
    code: "F10",
    name: "Exit (Panic Hardware)",
    category: "commercial",
    lockType: "exit-device",
    description: "Panic hardware function. The inside is always free (push bar or paddle). The outside may be locked or unlocked with a key. Used on exit doors, emergency exits, and fire-rated doors.",
    hasKeyOutside: true,
  },
  {
    code: "F11",
    name: "Vestibule",
    category: "commercial",
    lockType: "cylindrical",
    description: "Key operates both sides. Both outside and inside have key cylinders. Used for vestibules, entryways, and doors between two secure areas.",
    hasKeyOutside: true,
    hasKeyInside: true,
  },
  {
    code: "F12",
    name: "Dummy (Non-Functional)",
    category: "commercial",
    lockType: "dummy",
    description: "Non-functional trim. The lever is fixed and does not operate a latch. Used for double-door sets where one leaf is inactive, or for decorative applications.",
  },
  {
    code: "F13",
    name: "Communicating",
    category: "commercial",
    lockType: "cylindrical",
    description: "Keyed both sides with turn piece. Both sides have a key cylinder. A turn piece on each side allows locking/unlocking without a key. Used for communicating doors between offices or rooms.",
    hasKeyOutside: true,
    hasKeyInside: true,
    hasThumbTurn: true,
  },
  {
    code: "F14",
    name: "Entry",
    category: "commercial",
    lockType: "deadbolt",
    description: "Key outside, thumb turn inside. The outside has a key cylinder. The inside has a thumb turn to lock/unlock. Used for main entrances, exterior doors, and apartment doors.",
    hasKeyOutside: true,
    hasThumbTurn: true,
    hasDeadbolt: true,
  },
  {
    code: "F16",
    name: "Dummy Trim (Keyed)",
    category: "commercial",
    lockType: "dummy",
    description: "Keyed dummy trim. The lever is fixed but includes a key cylinder for aesthetic matching. Used on inactive doors in pairs where a matching keyed look is desired.",
    hasKeyOutside: true,
  },
  {
    code: "F17",
    name: "Dormitory Privacy",
    category: "commercial",
    lockType: "privacy",
    description: "Privacy lock with emergency release from outside. Push-button privacy on inside with an emergency release from the outside. Used for dormitory bedrooms and suite entrances.",
    hasPushButton: true,
    hasEmergencyRelease: true,
  },
  {
    code: "F22",
    name: "Hotel / Guest",
    category: "commercial",
    lockType: "hotel",
    description: "Key card outside, inside lock. Electronic key card reader on outside. Inside has a thumb turn or deadbolt for privacy. Used for hotel guest rooms, meeting rooms, and access-controlled areas.",
    hasKeycard: true,
    hasThumbTurn: true,
    hasDeadbolt: true,
  },
  {
    code: "F24",
    name: "Classroom Security",
    category: "commercial",
    lockType: "cylindrical",
    description: "Classroom security lock. Key outside locks or unlocks the outside lever. Inside lever is always free. The inside can lock the door without a key (push-button or turn). Used for modern classroom security requirements.",
    hasKeyOutside: true,
    hasPushButton: true,
  },
  // ── Electric Functions ──
  {
    code: "F25",
    name: "Electric Latch Retraction",
    category: "electric",
    lockType: "electric",
    description: "Electric latch retraction (ELR). The latch is retracted by an electric signal. Used with access control systems, automatic doors, and fire alarm integration. Fail-safe or fail-secure options available.",
    isElectrified: true,
  },
  {
    code: "F26",
    name: "Electric Locking",
    category: "electric",
    lockType: "electric",
    description: "Electric locking function. The lock is engaged or disengaged by an electric signal. Used for access-controlled doors, remote locking, and integrated security systems.",
    isElectrified: true,
    hasKeycard: true,
  },
  {
    code: "F27",
    name: "Electrified Panic Exit",
    category: "electric",
    lockType: "exit-device",
    description: "Electrified panic exit device. The push bar is normally locked and releases on signal or when pushed. Used for fire-rated exits with access control integration.",
    isElectrified: true,
  },
  {
    code: "F28",
    name: "Stairwell / Re-Entry",
    category: "electric",
    lockType: "electric",
    description: "Stairwell re-entry function. Allows re-entry from stairwell side after exit. Electrically controlled to meet fire code requirements for stairwell doors.",
    isElectrified: true,
    hasKeycard: true,
  },
  // ── Residential Functions ──
  {
    code: "R01",
    name: "Passage (Residential)",
    category: "residential",
    lockType: "passage",
    description: "Non-locking passage function. Both knobs or levers are always free. Used for hallways, closets, and doors between rooms where locking is not needed.",
    isAlwaysFree: true,
  },
  {
    code: "R02",
    name: "Privacy (Residential)",
    category: "residential",
    lockType: "privacy",
    description: "Privacy lock with emergency release. Locked from inside by a push button or turn button. An emergency release slot on the outside allows unlocking. Used for bedrooms and bathrooms.",
    hasPushButton: true,
    hasEmergencyRelease: true,
  },
  {
    code: "R03",
    name: "Entry (Residential)",
    category: "residential",
    lockType: "deadbolt",
    description: "Key outside, thumb turn or turn button inside. Used for exterior doors — front doors, back doors, and garage entry doors. The inside turn can lock/unlock without a key.",
    hasKeyOutside: true,
    hasThumbTurn: true,
    hasDeadbolt: true,
  },
  {
    code: "R04",
    name: "Dummy (Residential)",
    category: "residential",
    lockType: "dummy",
    description: "Non-functional dummy trim. Fixed knob or lever that does not operate a latch. Used for inactive doors in double-door sets or decorative applications.",
  },
];

/**
 * Generate an SVG diagram for a given lock function.
 * Uses a door cross-section from above view with lever handles,
 * key cylinders, push buttons, etc. — like manufacturer spec sheets.
 */
export function renderDoorDiagram(fn: LockFunction): string {
  const w = 380;
  const h = 250;
  const midX = w / 2;
  const doorY = 55;
  const doorH = 90;
  const doorW = 200;
  const doorX = (w - doorW) / 2;
  const leverY = doorY + doorH / 2;

  const outline = "#333";
  const fill = "#f0f0f0";
  const highlight = "#999";
  const highlightFill = "#bbb";
  const textColor = "#555";
  const mutedText = "#999";

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">`;

  // ── Door cross-section from above ──
  // Door body (thick rectangle)
  svg += `<rect x="${doorX}" y="${doorY}" width="${doorW}" height="${doorH}" rx="3" fill="white" stroke="${outline}" stroke-width="2"/>`;
  // Door thickness lines (top and bottom edge lines for 3D effect)
  svg += `<line x1="${doorX}" y1="${doorY + 8}" x2="${doorX + doorW}" y2="${doorY + 8}" stroke="${mutedText}" stroke-width="0.5"/>`;
  svg += `<line x1="${doorX}" y1="${doorY + doorH - 8}" x2="${doorX + doorW}" y2="${doorY + doorH - 8}" stroke="${mutedText}" stroke-width="0.5"/>`;

  // Outside/Inside labels
  svg += `<text x="${doorX - 10}" y="${doorY + doorH / 2 + 4}" text-anchor="end" font-size="11" fill="${textColor}" font-family="Arial, sans-serif" font-weight="bold">OUTSIDE</text>`;
  svg += `<text x="${doorX + doorW + 10}" y="${doorY + doorH / 2 + 4}" text-anchor="start" font-size="11" fill="${textColor}" font-family="Arial, sans-serif" font-weight="bold">INSIDE</text>`;

  // ── Lever handles ──
  // Outside lever
  const leverLen = 28;
  const leverThick = 4;
  const leverGap = 6;

  // Outside lever (left side)
  svg += `<rect x="${doorX - leverLen}" y="${leverY - leverThick / 2}" width="${leverLen}" height="${leverThick}" rx="2" fill="${fill}" stroke="${outline}" stroke-width="1.5"/>`;
  // Lever tip (slight curve/drop)
  svg += `<circle cx="${doorX - leverLen}" cy="${leverY}" r="3" fill="${fill}" stroke="${outline}" stroke-width="1.5"/>`;

  // Inside lever (right side)
  svg += `<rect x="${doorX + doorW}" y="${leverY - leverThick / 2}" width="${leverLen}" height="${leverThick}" rx="2" fill="${fill}" stroke="${outline}" stroke-width="1.5"/>`;
  svg += `<circle cx="${doorX + doorW + leverLen}" cy="${leverY}" r="3" fill="${fill}" stroke="${outline}" stroke-width="1.5"/>`;

  // Center line on door (latch line)
  svg += `<line x1="${midX}" y1="${doorY + 10}" x2="${midX}" y2="${doorY + doorH - 10}" stroke="${mutedText}" stroke-width="0.5" stroke-dasharray="3,3"/>`;

  // ── Draw function-specific components ──
  switch (fn.lockType) {
    case "passage":
      svg = drawPassage(svg, fn, doorX, doorY, doorW, doorH, leverY, outline, fill, highlight, highlightFill, textColor);
      break;
    case "privacy":
      svg = drawPrivacy(svg, fn, doorX, doorY, doorW, doorH, leverY, outline, fill, highlight, highlightFill, textColor);
      break;
    case "cylindrical":
      svg = drawCylindrical(svg, fn, doorX, doorY, doorW, doorH, leverY, outline, fill, highlight, highlightFill, textColor);
      break;
    case "exit-device":
      svg = drawExitDevice(svg, fn, doorX, doorY, doorW, doorH, leverY, outline, fill, highlight, highlightFill, textColor);
      break;
    case "deadbolt":
      svg = drawDeadbolt(svg, fn, doorX, doorY, doorW, doorH, leverY, outline, fill, highlight, highlightFill, textColor);
      break;
    case "hotel":
      svg = drawHotel(svg, fn, doorX, doorY, doorW, doorH, leverY, outline, fill, highlight, highlightFill, textColor);
      break;
    case "dummy":
      svg = drawDummy(svg, fn, doorX, doorY, doorW, doorH, leverY, outline, fill, highlight, highlightFill, textColor);
      break;
    case "electric":
      svg = drawElectric(svg, fn, doorX, doorY, doorW, doorH, leverY, outline, fill, highlight, highlightFill, textColor);
      break;
  }

  // Function code at bottom
  svg += `<text x="${midX}" y="${doorY + doorH + 45}" text-anchor="middle" font-size="12" fill="${mutedText}" font-family="Arial, sans-serif">${fn.code} — ${fn.name}</text>`;

  svg += `</svg>`;
  return svg;
}

// ── Draw Helpers ──

function drawKeyCylinder(svg: string, x: number, y: number, label: string, outline: string, highlightFill: string, textColor: string): string {
  svg += `<circle cx="${x}" cy="${y}" r="10" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
  svg += `<rect x="${x - 3}" y="${y - 2}" width="6" height="4" rx="1" fill="${outline}"/>`;
  svg += `<text x="${x}" y="${y + 22}" text-anchor="middle" font-size="8" fill="${textColor}" font-family="Arial, sans-serif">${label}</text>`;
  return svg;
}

function drawPushButton(svg: string, x: number, y: number, label: string, outline: string, highlightFill: string, textColor: string): string {
  svg += `<rect x="${x - 8}" y="${y - 8}" width="16" height="16" rx="4" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
  svg += `<text x="${x}" y="${y + 3}" text-anchor="middle" font-size="9" fill="white" font-family="Arial, sans-serif" font-weight="bold">P</text>`;
  svg += `<text x="${x}" y="${y + 22}" text-anchor="middle" font-size="8" fill="${textColor}" font-family="Arial, sans-serif">${label}</text>`;
  return svg;
}

function drawThumbTurn(svg: string, x: number, y: number, label: string, outline: string, highlightFill: string, textColor: string): string {
  svg += `<ellipse cx="${x}" cy="${y}" rx="8" ry="6" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
  svg += `<line x1="${x - 5}" y1="${y}" x2="${x + 5}" y2="${y}" stroke="${outline}" stroke-width="2"/>`;
  svg += `<text x="${x}" y="${y + 18}" text-anchor="middle" font-size="8" fill="${textColor}" font-family="Arial, sans-serif">${label}</text>`;
  return svg;
}

function drawEmergencyRelease(svg: string, x: number, y: number, label: string, outline: string, highlightFill: string, textColor: string): string {
  svg += `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" rx="2" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
  svg += `<text x="${x}" y="${y + 3}" text-anchor="middle" font-size="8" fill="${outline}" font-family="Arial, sans-serif">⌕</text>`;
  svg += `<text x="${x}" y="${y + 20}" text-anchor="middle" font-size="8" fill="${textColor}" font-family="Arial, sans-serif">${label}</text>`;
  return svg;
}

function drawLabel(svg: string, x: number, y: number, text: string, color: string, fontSize: number = 9): string {
  svg += `<text x="${x}" y="${y}" text-anchor="middle" font-size="${fontSize}" fill="${color}" font-family="Arial, sans-serif">${text}</text>`;
  return svg;
}

function drawLineLabel(svg: string, x: number, y: number, text: string, color: string): string {
  svg += `<text x="${x}" y="${y}" text-anchor="middle" font-size="8" fill="${color}" font-family="Arial, sans-serif">${text}</text>`;
  return svg;
}

// ── Function-specific renderers ──

function drawPassage(
  svg: string, fn: LockFunction, doorX: number, doorY: number, doorW: number, doorH: number, leverY: number,
  outline: string, fill: string, highlight: string, highlightFill: string, textColor: string,
): string {
  const midX = doorX + doorW / 2;
  // Free labels on both sides
  svg = drawLabel(svg, doorX - 50, leverY - 15, "Always", highlight);
  svg = drawLabel(svg, doorX - 50, leverY - 3, "Free", highlight);
  svg = drawLabel(svg, doorX + doorW + 50, leverY - 15, "Always", highlight);
  svg = drawLabel(svg, doorX + doorW + 50, leverY - 3, "Free", highlight);
  // Center label
  svg = drawLabel(svg, midX, doorY + doorH + 20, "Both levers always free", textColor, 9);
  return svg;
}

function drawPrivacy(
  svg: string, fn: LockFunction, doorX: number, doorY: number, doorW: number, doorH: number, leverY: number,
  outline: string, fill: string, highlight: string, highlightFill: string, textColor: string,
): string {
  const midX = doorX + doorW / 2;
  // Emergency release on outside
  if (fn.hasEmergencyRelease) {
    svg = drawEmergencyRelease(svg, doorX - 50, leverY, "Emergency Release", outline, highlightFill, textColor);
  }
  // Push button on inside
  if (fn.hasPushButton) {
    svg = drawPushButton(svg, doorX + doorW + 50, leverY, "Push to Lock", outline, highlightFill, textColor);
  }
  svg = drawLabel(svg, midX, doorY + doorH + 20, "Privacy lock — unlock from outside with tool", textColor, 9);
  return svg;
}

function drawCylindrical(
  svg: string, fn: LockFunction, doorX: number, doorY: number, doorW: number, doorH: number, leverY: number,
  outline: string, fill: string, highlight: string, highlightFill: string, textColor: string,
): string {
  const midX = doorX + doorW / 2;
  const compY = leverY;

  // Key cylinder on outside
  if (fn.hasKeyOutside) {
    svg = drawKeyCylinder(svg, doorX - 50, compY, fn.isAlwaysLocked ? "Key Outside (Locked)" : "Key Outside", outline, highlightFill, textColor);
  }

  // Key cylinder on inside
  if (fn.hasKeyInside) {
    svg = drawKeyCylinder(svg, doorX + doorW + 50, compY, "Key Inside", outline, highlightFill, textColor);
  }

  // Push button on inside
  if (fn.hasPushButton) {
    svg = drawPushButton(svg, doorX + doorW + 50, compY, fn.hasKeyInside ? "Push to Lock" : "Push Button", outline, highlightFill, textColor);
  }

  // Thumb turn on inside
  if (fn.hasThumbTurn) {
    svg = drawThumbTurn(svg, doorX + doorW + 50, compY, "Thumb Turn", outline, highlightFill, textColor);
  }

  // Latch bolt indicator
  if (fn.isAlwaysLocked) {
    svg = drawLineLabel(svg, midX, doorY + doorH + 10, "Latch — Locked", "#d32f2f");
  } else if (fn.isAlwaysFree) {
    svg = drawLineLabel(svg, midX, doorY + doorH + 10, "Latch — Free", "#2e7d32");
  } else {
    svg = drawLineLabel(svg, midX, doorY + doorH + 10, "Latch", textColor);
  }

  return svg;
}

function drawExitDevice(
  svg: string, fn: LockFunction, doorX: number, doorY: number, doorW: number, doorH: number, leverY: number,
  outline: string, fill: string, highlight: string, highlightFill: string, textColor: string,
): string {
  const midX = doorX + doorW / 2;

  // Key cylinder on outside
  if (fn.hasKeyOutside) {
    svg = drawKeyCylinder(svg, doorX - 50, leverY, "Key Cylinder", outline, highlightFill, textColor);
  }

  // Push bar on inside (shown as thick horizontal bar across the door)
  const barY = doorY + doorH + 8;
  const barW = doorW - 20;
  const barX = doorX + 10;
  svg += `<rect x="${barX}" y="${barY}" width="${barW}" height="7" rx="2" fill="${highlightFill}" stroke="${outline}" stroke-width="1"/>`;
  svg = drawLineLabel(svg, midX, barY + 18, "Push Bar → Free Exit", textColor);

  // Electrified
  if (fn.isElectrified) {
    svg = drawLineLabel(svg, doorX + doorW + 50, leverY, "⚡ Electrified", outline);
  }

  return svg;
}

function drawDeadbolt(
  svg: string, fn: LockFunction, doorX: number, doorY: number, doorW: number, doorH: number, leverY: number,
  outline: string, fill: string, highlight: string, highlightFill: string, textColor: string,
): string {
  const midX = doorX + doorW / 2;

  // Key cylinder outside
  if (fn.hasKeyOutside) {
    svg = drawKeyCylinder(svg, doorX - 50, leverY, "Key Cylinder", outline, highlightFill, textColor);
  }

  // Thumb turn inside
  if (fn.hasThumbTurn) {
    svg = drawThumbTurn(svg, doorX + doorW + 50, leverY, "Thumb Turn", outline, highlightFill, textColor);
  }

  // Deadbolt latch extending from the door
  const dbX = doorX + doorW + 2;
  const dbY = leverY - 5;
  svg += `<rect x="${dbX}" y="${dbY}" width="14" height="10" rx="2" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
  svg = drawLineLabel(svg, midX, doorY + doorH + 10, "Deadbolt", textColor);
  return svg;
}

function drawHotel(
  svg: string, fn: LockFunction, doorX: number, doorY: number, doorW: number, doorH: number, leverY: number,
  outline: string, fill: string, highlight: string, highlightFill: string, textColor: string,
): string {
  const midX = doorX + doorW / 2;

  // Key card reader outside
  if (fn.hasKeycard) {
    const readerX = doorX - 50;
    const readerY = leverY;
    svg += `<rect x="${readerX - 10}" y="${readerY - 14}" width="20" height="28" rx="3" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
    // Card slot
    svg += `<rect x="${readerX - 7}" y="${readerY - 9}" width="14" height="3" rx="1" fill="${outline}"/>`;
    // LED indicator
    svg += `<circle cx="${readerX}" cy="${readerY + 8}" r="3" fill="${highlight}" stroke="${outline}" stroke-width="0.5"/>`;
    svg = drawLineLabel(svg, readerX, readerY + 22, "Key Card Reader", textColor);
  }

  // Thumb turn inside
  if (fn.hasThumbTurn) {
    svg = drawThumbTurn(svg, doorX + doorW + 50, leverY, "Privacy Lock", outline, highlightFill, textColor);
  }

  // Deadbolt
  if (fn.hasDeadbolt) {
    svg = drawLineLabel(svg, midX, doorY + doorH + 10, "Deadbolt", textColor);
  }

  // DND
  svg = drawLineLabel(svg, midX, doorY + doorH + 22, "Do Not Disturb", highlight);

  return svg;
}

function drawDummy(
  svg: string, fn: LockFunction, doorX: number, doorY: number, doorW: number, doorH: number, leverY: number,
  outline: string, fill: string, highlight: string, highlightFill: string, textColor: string,
): string {
  const midX = doorX + doorW / 2;

  // Fixed lever indication (X through the lever)
  svg += `<line x1="${doorX - 4}" y1="${leverY - 4}" x2="${doorX - leverLen + 4}" y2="${leverY + 4}" stroke="${highlight}" stroke-width="1.5"/>`;
  svg += `<line x1="${doorX - 4}" y1="${leverY + 4}" x2="${doorX - leverLen + 4}" y2="${leverY - 4}" stroke="${highlight}" stroke-width="1.5"/>`;
  svg += `<line x1="${doorX + doorW + 4}" y1="${leverY - 4}" x2="${doorX + doorW + leverLen - 4}" y2="${leverY + 4}" stroke="${highlight}" stroke-width="1.5"/>`;
  svg += `<line x1="${doorX + doorW + 4}" y1="${leverY + 4}" x2="${doorX + doorW + leverLen - 4}" y2="${leverY - 4}" stroke="${highlight}" stroke-width="1.5"/>`;

  if (fn.hasKeyOutside) {
    svg = drawKeyCylinder(svg, doorX - 50, leverY, "Key Cylinder", outline, highlightFill, textColor);
  }

  svg = drawLineLabel(svg, midX, doorY + doorH + 10, "Fixed — No Latch", highlight);
  return svg;
}

function drawElectric(
  svg: string, fn: LockFunction, doorX: number, doorY: number, doorW: number, doorH: number, leverY: number,
  outline: string, fill: string, highlight: string, highlightFill: string, textColor: string,
): string {
  const midX = doorX + doorW / 2;

  // Access control / key card reader
  if (fn.hasKeycard) {
    const readerX = doorX - 50;
    const readerY = leverY;
    svg += `<rect x="${readerX - 10}" y="${readerY - 12}" width="20" height="24" rx="3" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
    svg += `<rect x="${readerX - 7}" y="${readerY - 7}" width="14" height="2" rx="1" fill="${outline}"/>`;
    svg = drawLineLabel(svg, readerX, readerY + 20, "Access Control", textColor);
  }

  // Electric strike indicator
  const strikeX = doorX + doorW + 2;
  const strikeY = leverY - 8;
  svg += `<rect x="${strikeX}" y="${strikeY}" width="10" height="16" rx="2" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
  // Wiring lines
  svg += `<line x1="${strikeX + 5}" y1="${strikeY - 8}" x2="${strikeX + 5}" y2="${strikeY - 2}" stroke="${outline}" stroke-width="1"/>`;
  svg += `<circle cx="${strikeX + 5}" cy="${strikeY - 10}" r="2" fill="${outline}"/>`;

  svg = drawLineLabel(svg, midX, doorY + doorH + 10, "⚡ Electric Strike", outline);
  return svg;
}