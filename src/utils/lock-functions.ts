/**
 * Lock function definitions with SVG diagram generators.
 * Each function has a code, name, description, and a lockType
 * that determines which hardware silhouette to render.
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
 * Generate an SVG hardware silhouette diagram for a given lock function.
 * Shows actual lock hardware instead of a door schematic with icons.
 */
export function renderDoorDiagram(fn: LockFunction): string {
  const w = 360;
  const h = 260;
  const midX = w / 2;
  const doorY = 20;
  const doorH = h - 40;
  const doorW = 300;
  const doorX = (w - doorW) / 2;
  const centerLine = doorX + doorW / 2;

  // Colors
  const outline = "#333";
  const fill = "#f0f0f0";
  const highlight = "#999";
  const highlightFill = "#bbb";
  const textColor = "#555";
  const mutedText = "#999";

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">`;

  // Subtle door outline as context
  svg += `<rect x="${doorX}" y="${doorY}" width="${doorW}" height="${doorH}" rx="4" fill="white" stroke="${mutedText}" stroke-width="1" stroke-dasharray="4,3"/>`;
  // Center line
  svg += `<line x1="${centerLine}" y1="${doorY + 4}" x2="${centerLine}" y2="${doorY + doorH - 4}" stroke="${mutedText}" stroke-width="0.5" stroke-dasharray="3,3"/>`;
  // Outside/Inside labels
  svg += `<text x="${doorX + 20}" y="${doorY + 18}" font-size="9" fill="${mutedText}" font-family="Arial, sans-serif">OUTSIDE</text>`;
  svg += `<text x="${doorX + doorW - 65}" y="${doorY + 18}" font-size="9" fill="${mutedText}" font-family="Arial, sans-serif">INSIDE</text>`;

  // Render the appropriate hardware silhouette
  const lockBodyX = midX - 50;
  const lockBodyY = doorY + 80;
  const lockBodyW = 100;
  const lockBodyH = 70;

  switch (fn.lockType) {
    case "passage":
      svg = renderPassageLock(svg, lockBodyX, lockBodyY, lockBodyW, lockBodyH, outline, fill, highlight, highlightFill, textColor);
      break;
    case "privacy":
      svg = renderPrivacyLock(svg, lockBodyX, lockBodyY, lockBodyW, lockBodyH, fn, outline, fill, highlight, highlightFill, textColor);
      break;
    case "cylindrical":
      svg = renderCylindricalLock(svg, lockBodyX, lockBodyY, lockBodyW, lockBodyH, fn, outline, fill, highlight, highlightFill, textColor);
      break;
    case "exit-device":
      svg = renderExitDevice(svg, lockBodyX, lockBodyY, lockBodyW, lockBodyH, fn, outline, fill, highlight, highlightFill, textColor);
      break;
    case "deadbolt":
      svg = renderDeadbolt(svg, lockBodyX, lockBodyY, lockBodyW, lockBodyH, fn, outline, fill, highlight, highlightFill, textColor);
      break;
    case "hotel":
      svg = renderHotelLock(svg, lockBodyX, lockBodyY, lockBodyW, lockBodyH, fn, outline, fill, highlight, highlightFill, textColor);
      break;
    case "dummy":
      svg = renderDummyTrim(svg, lockBodyX, lockBodyY, lockBodyW, lockBodyH, fn, outline, fill, highlight, highlightFill, textColor);
      break;
    case "electric":
      svg = renderElectricLock(svg, lockBodyX, lockBodyY, lockBodyW, lockBodyH, fn, outline, fill, highlight, highlightFill, textColor);
      break;
  }

  // Function code label at bottom
  svg += `<text x="${midX}" y="${doorY + doorH - 8}" text-anchor="middle" font-size="11" fill="${mutedText}" font-family="Arial, sans-serif">${fn.code} — ${fn.name}</text>`;

  svg += `</svg>`;
  return svg;
}

// ── Render Helpers ──

function renderPassageLock(
  svg: string, x: number, y: number, w: number, h: number,
  outline: string, fill: string, highlight: string, highlightFill: string, textColor: string,
): string {
  // Lock chassis body
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${outline}" stroke-width="1.5"/>`;
  // Free indicator — both sides
  svg += `<text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle" font-size="10" fill="${highlight}" font-family="Arial, sans-serif">Always Unlocked</text>`;
  // Label
  svg += `<text x="${x + w / 2}" y="${y - 8}" text-anchor="middle" font-size="8" fill="${textColor}" font-family="Arial, sans-serif">Passage Lock Body</text>`;
  // Both sides free
  svg += `<text x="${x - 30}" y="${y + h / 2 + 4}" text-anchor="middle" font-size="8" fill="${textColor}" font-family="Arial, sans-serif">Free</text>`;
  svg += `<text x="${x + w + 30}" y="${y + h / 2 + 4}" text-anchor="middle" font-size="8" fill="${textColor}" font-family="Arial, sans-serif">Free</text>`;
  // Small arrows showing free movement on both sides
  svg = arrowLeft(svg, x - 5, y + h / 2, highlight);
  svg = arrowRight(svg, x + w + 5, y + h / 2, highlight);
  return svg;
}

function renderPrivacyLock(
  svg: string, x: number, y: number, w: number, h: number,
  fn: LockFunction, outline: string, fill: string, highlight: string, highlightFill: string, textColor: string,
): string {
  // Lock chassis body
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${outline}" stroke-width="1.5"/>`;

  // Left side: Emergency release (if applicable)
  if (fn.hasEmergencyRelease) {
    // Small slot/tool release
    svg += `<rect x="${x - 18}" y="${y + h / 2 - 8}" width="16" height="16" rx="2" fill="${highlightFill}" stroke="${outline}" stroke-width="1"/>`;
    svg += `<text x="${x - 10}" y="${y + h / 2 + 4}" text-anchor="middle" font-size="6" fill="white" font-family="Arial, sans-serif">⌕</text>`;
    svg += `<text x="${x - 10}" y="${y + h / 2 + 20}" text-anchor="middle" font-size="7" fill="${textColor}" font-family="Arial, sans-serif">Emergency Release</text>`;
  }

  // Right side: Push button
  if (fn.hasPushButton) {
    svg += `<rect x="${x + w + 2}" y="${y + h / 2 - 10}" width="20" height="20" rx="5" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
    svg += `<text x="${x + w + 12}" y="${y + h / 2 + 4}" text-anchor="middle" font-size="8" fill="white" font-family="Arial, sans-serif">P</text>`;
    svg += `<text x="${x + w + 12}" y="${y + h / 2 + 20}" text-anchor="middle" font-size="7" fill="${textColor}" font-family="Arial, sans-serif">Push Button</text>`;
  }

  // Label
  svg += `<text x="${x + w / 2}" y="${y - 8}" text-anchor="middle" font-size="8" fill="${textColor}" font-family="Arial, sans-serif">Privacy Lock</text>`;
  return svg;
}

function renderCylindricalLock(
  svg: string, x: number, y: number, w: number, h: number,
  fn: LockFunction, outline: string, fill: string, highlight: string, highlightFill: string, textColor: string,
): string {
  // Lock chassis body
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${outline}" stroke-width="1.5"/>`;

  // Left side: Key cylinder
  if (fn.hasKeyOutside) {
    // Cylinder circle
    svg += `<circle cx="${x - 14}" cy="${y + h / 2}" r="12" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
    // Keyway slot
    svg += `<rect x="${x - 17}" y="${y + h / 2 - 2}" width="6" height="4" rx="1" fill="${outline}"/>`;
    svg += `<text x="${x - 14}" y="${y + h / 2 + 26}" text-anchor="middle" font-size="7" fill="${textColor}" font-family="Arial, sans-serif">Key Outside</text>`;
  }

  // Right side: Push button or thumb turn
  if (fn.hasPushButton) {
    svg += `<rect x="${x + w + 2}" y="${y + h / 2 - 10}" width="20" height="20" rx="5" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
    svg += `<text x="${x + w + 12}" y="${y + h / 2 + 4}" text-anchor="middle" font-size="8" fill="white" font-family="Arial, sans-serif">P</text>`;
    svg += `<text x="${x + w + 12}" y="${y + h / 2 + 20}" text-anchor="middle" font-size="7" fill="${textColor}" font-family="Arial, sans-serif">Push Button</text>`;
  } else if (fn.hasThumbTurn) {
    // Thumb turn — oval shape
    svg += `<ellipse cx="${x + w + 12}" cy="${y + h / 2}" rx="9" ry="7" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
    svg += `<line x1="${x + w + 6}" y1="${y + h / 2}" x2="${x + w + 18}" y2="${y + h / 2}" stroke="${outline}" stroke-width="2"/>`;
    svg += `<text x="${x + w + 12}" y="${y + h / 2 + 20}" text-anchor="middle" font-size="7" fill="${textColor}" font-family="Arial, sans-serif">Thumb Turn</text>`;
  }

  // If key inside
  if (fn.hasKeyInside) {
    svg += `<circle cx="${x + w + 14}" cy="${y + h / 2}" r="12" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5" stroke-dasharray="3,2"/>`;
    svg += `<rect x="${x + w + 11}" y="${y + h / 2 - 2}" width="6" height="4" rx="1" fill="${outline}"/>`;
    svg += `<text x="${x + w + 14}" y="${y + h / 2 + 26}" text-anchor="middle" font-size="7" fill="${textColor}" font-family="Arial, sans-serif">Key Inside</text>`;
  }

  // Latch bolt extending from the lock body
  const latchX = x + w - 2;
  const latchY = y + h / 2 - 6;
  if (fn.isAlwaysLocked) {
    // Extended latch (locked)
    svg += `<rect x="${latchX}" y="${latchY}" width="12" height="12" rx="2" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
    svg += `<text x="${latchX + 6}" y="${latchY + 24}" text-anchor="middle" font-size="6" fill="${textColor}" font-family="Arial, sans-serif">Locked</text>`;
  } else if (fn.isAlwaysFree) {
    // Retracted latch (free)
    svg += `<rect x="${latchX}" y="${latchY}" width="6" height="12" rx="1" fill="${fill}" stroke="${highlight}" stroke-width="1"/>`;
    svg += `<text x="${latchX + 3}" y="${latchY + 24}" text-anchor="middle" font-size="6" fill="${textColor}" font-family="Arial, sans-serif">Free</text>`;
  } else {
    // Normal latch
    svg += `<rect x="${latchX}" y="${latchY}" width="8" height="12" rx="1.5" fill="${highlightFill}" stroke="${outline}" stroke-width="1"/>`;
  }

  // Label
  svg += `<text x="${x + w / 2}" y="${y - 8}" text-anchor="middle" font-size="8" fill="${textColor}" font-family="Arial, sans-serif">Cylindrical Lock</text>`;
  return svg;
}

function renderExitDevice(
  svg: string, x: number, y: number, w: number, h: number,
  fn: LockFunction, outline: string, fill: string, highlight: string, highlightFill: string, textColor: string,
): string {
  // Door outline (already drawn, but add a subtle push bar area)

  // Push bar — horizontal bar across the door
  const barY = y + 20;
  const barH = 16;
  const barW = w - 20;
  const barX = x + 10;

  // Push bar mounting brackets
  svg += `<rect x="${barX}" y="${barY}" width="8" height="${barH}" rx="2" fill="${highlight}" stroke="${outline}" stroke-width="1"/>`;
  svg += `<rect x="${barX + barW - 8}" y="${barY}" width="8" height="${barH}" rx="2" fill="${highlight}" stroke="${outline}" stroke-width="1"/>`;

  // Push bar itself
  svg += `<rect x="${barX + 8}" y="${barY + 3}" width="${barW - 16}" height="${barH - 6}" rx="3" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
  svg += `<text x="${barX + barW / 2}" y="${barY + barH / 2 + 1}" text-anchor="middle" font-size="8" fill="white" font-family="Arial, sans-serif">PUSH BAR</text>`;

  // Key cylinder on outside (left)
  if (fn.hasKeyOutside) {
    const cylX = x - 14;
    const cylY = y + h / 2 + 20;
    svg += `<circle cx="${cylX}" cy="${cylY}" r="10" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
    svg += `<rect x="${cylX - 3}" y="${cylY - 2}" width="6" height="4" rx="1" fill="${outline}"/>`;
    svg += `<text x="${cylX}" y="${cylY + 22}" text-anchor="middle" font-size="7" fill="${textColor}" font-family="Arial, sans-serif">Key Cylinder</text>`;
  }

  // Electrified indicator
  if (fn.isElectrified) {
    svg += `<text x="${x + w + 20}" y="${y + 15}" font-size="8" fill="${outline}" font-family="Arial, sans-serif">⚡</text>`;
    svg += `<text x="${x + w + 20}" y="${y + 28}" text-anchor="middle" font-size="6" fill="${textColor}" font-family="Arial, sans-serif">Electrified</text>`;
  }

  // Latch mechanism at top
  svg += `<rect x="${x + w / 2 - 5}" y="${y - 5}" width="10" height="8" rx="2" fill="${highlightFill}" stroke="${outline}" stroke-width="1"/>`;
  svg += `<text x="${x + w / 2}" y="${y - 10}" text-anchor="middle" font-size="7" fill="${textColor}" font-family="Arial, sans-serif">Latch</text>`;

  // Label
  svg += `<text x="${x + w / 2}" y="${y + h + 12}" text-anchor="middle" font-size="8" fill="${textColor}" font-family="Arial, sans-serif">Exit Device</text>`;
  return svg;
}

function renderDeadbolt(
  svg: string, x: number, y: number, w: number, h: number,
  fn: LockFunction, outline: string, fill: string, highlight: string, highlightFill: string, textColor: string,
): string {
  // Deadbolt body (narrower, taller)
  const bodyW = 60;
  const bodyX = x + (w - bodyW) / 2;
  svg += `<rect x="${bodyX}" y="${y + 10}" width="${bodyW}" height="${h - 20}" rx="4" fill="${fill}" stroke="${outline}" stroke-width="1.5"/>`;

  // Key cylinder on left
  if (fn.hasKeyOutside) {
    svg += `<circle cx="${bodyX - 14}" cy="${y + h / 2}" r="12" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
    svg += `<rect x="${bodyX - 17}" y="${y + h / 2 - 2}" width="6" height="4" rx="1" fill="${outline}"/>`;
    svg += `<text x="${bodyX - 14}" y="${y + h / 2 + 26}" text-anchor="middle" font-size="7" fill="${textColor}" font-family="Arial, sans-serif">Key Cylinder</text>`;
  }

  // Thumb turn on right
  if (fn.hasThumbTurn) {
    svg += `<ellipse cx="${bodyX + bodyW + 14}" cy="${y + h / 2}" rx="9" ry="7" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
    svg += `<line x1="${bodyX + bodyW + 8}" y1="${y + h / 2}" x2="${bodyX + bodyW + 20}" y2="${y + h / 2}" stroke="${outline}" stroke-width="2"/>`;
    svg += `<text x="${bodyX + bodyW + 14}" y="${y + h / 2 + 20}" text-anchor="middle" font-size="7" fill="${textColor}" font-family="Arial, sans-serif">Thumb Turn</text>`;
  }

  // Deadbolt latch extending from the body
  const latchX = bodyX + bodyW - 2;
  const latchY = y + h / 2 - 6;
  svg += `<rect x="${latchX}" y="${latchY}" width="14" height="12" rx="2" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
  svg += `<text x="${latchX + 7}" y="${latchY + 24}" text-anchor="middle" font-size="6" fill="${textColor}" font-family="Arial, sans-serif">Deadbolt</text>`;

  // Label
  svg += `<text x="${bodyX + bodyW / 2}" y="${y - 2}" text-anchor="middle" font-size="8" fill="${textColor}" font-family="Arial, sans-serif">Deadbolt Lock</text>`;
  return svg;
}

function renderHotelLock(
  svg: string, x: number, y: number, w: number, h: number,
  fn: LockFunction, outline: string, fill: string, highlight: string, highlightFill: string, textColor: string,
): string {
  // Lock body
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${outline}" stroke-width="1.5"/>`;

  // Key card reader on outside (left)
  if (fn.hasKeycard) {
    const readerX = x - 20;
    const readerY = y + h / 2 - 16;
    svg += `<rect x="${readerX}" y="${readerY}" width="20" height="32" rx="3" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
    // Card slot
    svg += `<rect x="${readerX + 3}" y="${readerY + 4}" width="14" height="3" rx="1" fill="${outline}"/>`;
    // LED indicators
    svg += `<circle cx="${readerX + 10}" cy="${readerY + 24}" r="3" fill="${highlight}" stroke="${outline}" stroke-width="0.5"/>`;
    svg += `<text x="${readerX + 10}" y="${readerY + 46}" text-anchor="middle" font-size="7" fill="${textColor}" font-family="Arial, sans-serif">Key Card Reader</text>`;
  }

  // Privacy thumb turn on inside (right)
  if (fn.hasThumbTurn) {
    svg += `<ellipse cx="${x + w + 14}" cy="${y + h / 2 - 8}" rx="9" ry="7" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
    svg += `<line x1="${x + w + 8}" y1="${y + h / 2 - 8}" x2="${x + w + 20}" y2="${y + h / 2 - 8}" stroke="${outline}" stroke-width="2"/>`;
    svg += `<text x="${x + w + 14}" y="${y + h / 2 + 12}" text-anchor="middle" font-size="7" fill="${textColor}" font-family="Arial, sans-serif">Privacy Lock</text>`;
  }

  // Deadbolt indicator
  if (fn.hasDeadbolt) {
    const dbX = x + w / 2 - 6;
    const dbY = y + h - 20;
    svg += `<rect x="${dbX}" y="${dbY}" width="12" height="14" rx="2" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
    svg += `<text x="${dbX + 6}" y="${dbY + 24}" text-anchor="middle" font-size="6" fill="${textColor}" font-family="Arial, sans-serif">Deadbolt</text>`;
  }

  // "Do Not Disturb" indicator
  svg += `<text x="${x + w / 2}" y="${y + 16}" text-anchor="middle" font-size="7" fill="${highlight}" font-family="Arial, sans-serif">DND</text>`;

  // Label
  svg += `<text x="${x + w / 2}" y="${y - 8}" text-anchor="middle" font-size="8" fill="${textColor}" font-family="Arial, sans-serif">Hotel Function Lock</text>`;
  return svg;
}

function renderDummyTrim(
  svg: string, x: number, y: number, w: number, h: number,
  fn: LockFunction, outline: string, fill: string, highlight: string, highlightFill: string, textColor: string,
): string {
  // Fixed lever silhouette — no latch body, just a lever
  const leverX = x + w / 2 - 4;
  const leverY = y + 20;

  // Rosette / base plate
  svg += `<circle cx="${x + w / 2}" cy="${y + 30}" r="16" fill="${fill}" stroke="${outline}" stroke-width="1.5"/>`;

  // Fixed lever (horizontal, no movement)
  svg += `<rect x="${x + w / 2 - 30}" y="${y + 26}" width="60" height="7" rx="2" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;

  // Key cylinder if present
  if (fn.hasKeyOutside) {
    svg += `<circle cx="${x - 14}" cy="${y + 30}" r="10" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
    svg += `<rect x="${x - 17}" y="${y + 28}" width="6" height="4" rx="1" fill="${outline}"/>`;
    svg += `<text x="${x - 14}" y="${y + 54}" text-anchor="middle" font-size="7" fill="${textColor}" font-family="Arial, sans-serif">Key Cylinder</text>`;
  }

  // No latch indicator
  svg += `<text x="${x + w / 2}" y="${y + 55}" text-anchor="middle" font-size="7" fill="${highlight}" font-family="Arial, sans-serif">No Latch — Fixed</text>`;

  // Label
  svg += `<text x="${x + w / 2}" y="${y - 8}" text-anchor="middle" font-size="8" fill="${textColor}" font-family="Arial, sans-serif">Dummy Trim</text>`;
  return svg;
}

function renderElectricLock(
  svg: string, x: number, y: number, w: number, h: number,
  fn: LockFunction, outline: string, fill: string, highlight: string, highlightFill: string, textColor: string,
): string {
  // Electric lock body
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" stroke="${outline}" stroke-width="1.5"/>`;

  // Solenoid highlight (center of lock body)
  svg += `<rect x="${x + w / 2 - 12}" y="${y + 15}" width="24" height="${h - 30}" rx="3" fill="${highlightFill}" stroke="${outline}" stroke-width="1"/>`;
  svg += `<text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle" font-size="7" fill="white" font-family="Arial, sans-serif">SOL</text>`;

  // Wiring/connector indicators
  svg += `<line x1="${x + w / 2 - 4}" y1="${y - 5}" x2="${x + w / 2 - 4}" y2="${y + 3}" stroke="${outline}" stroke-width="1.5"/>`;
  svg += `<line x1="${x + w / 2 + 4}" y1="${y - 5}" x2="${x + w / 2 + 4}" y2="${y + 3}" stroke="${outline}" stroke-width="1.5"/>`;
  svg += `<circle cx="${x + w / 2 - 4}" cy="${y - 7}" r="2" fill="${outline}"/>`;
  svg += `<circle cx="${x + w / 2 + 4}" cy="${y - 7}" r="2" fill="${outline}"/>`;
  svg += `<text x="${x + w / 2}" y="${y - 14}" text-anchor="middle" font-size="6" fill="${textColor}" font-family="Arial, sans-serif">Wiring</text>`;

  // Key card reader on outside
  if (fn.hasKeycard) {
    const readerX = x - 20;
    const readerY = y + h / 2 - 12;
    svg += `<rect x="${readerX}" y="${readerY}" width="20" height="24" rx="3" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
    svg += `<rect x="${readerX + 3}" y="${readerY + 4}" width="14" height="2" rx="1" fill="${outline}"/>`;
    svg += `<text x="${readerX + 10}" y="${readerY + 36}" text-anchor="middle" font-size="7" fill="${textColor}" font-family="Arial, sans-serif">Access Control</text>`;
  }

  // Electric strike on right side
  svg += `<rect x="${x + w + 2}" y="${y + h / 2 - 8}" width="10" height="16" rx="2" fill="${highlightFill}" stroke="${outline}" stroke-width="1.5"/>`;
  svg += `<text x="${x + w + 7}" y="${y + h / 2 + 24}" text-anchor="middle" font-size="6" fill="${textColor}" font-family="Arial, sans-serif">Strike</text>`;

  // ⚡ indicator
  svg += `<text x="${x + w / 2}" y="${y + h + 12}" text-anchor="middle" font-size="9" fill="${outline}" font-family="Arial, sans-serif">⚡ Electrified</text>`;

  // Label
  svg += `<text x="${x + w / 2}" y="${y - 8}" text-anchor="middle" font-size="8" fill="${textColor}" font-family="Arial, sans-serif">Electric Lock Mechanism</text>`;
  return svg;
}

// Small arrow helpers
function arrowLeft(svg: string, x: number, y: number, color: string): string {
  svg += `<line x1="${x}" y1="${y}" x2="${x - 12}" y2="${y}" stroke="${color}" stroke-width="1.5"/>`;
  svg += `<line x1="${x - 12}" y1="${y}" x2="${x - 8}" y2="${y - 4}" stroke="${color}" stroke-width="1.5"/>`;
  svg += `<line x1="${x - 12}" y1="${y}" x2="${x - 8}" y2="${y + 4}" stroke="${color}" stroke-width="1.5"/>`;
  return svg;
}
function arrowRight(svg: string, x: number, y: number, color: string): string {
  svg += `<line x1="${x}" y1="${y}" x2="${x + 12}" y2="${y}" stroke="${color}" stroke-width="1.5"/>`;
  svg += `<line x1="${x + 12}" y1="${y}" x2="${x + 8}" y2="${y - 4}" stroke="${color}" stroke-width="1.5"/>`;
  svg += `<line x1="${x + 12}" y1="${y}" x2="${x + 8}" y2="${y + 4}" stroke="${color}" stroke-width="1.5"/>`;
  return svg;
}