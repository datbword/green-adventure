/**
 * Lock function definitions with SVG diagram generators.
 * Each function has a code, name, description, and a render function
 * that returns an inline SVG string.
 */

export interface LockFunction {
  code: string;
  name: string;
  description: string;
  category: "commercial" | "residential" | "electric";
  /**
   * SVG elements to render inside the door diagram.
   * Each element: { type: "key"|"button"|"thumbturn"|"release"|"label"|"deadbolt",
   *   side: "outside"|"inside"|"center",
   *   label: string, extra?: string }
   */
  elements: DoorElement[];
}

export interface DoorElement {
  type: "key" | "button" | "thumbturn" | "release" | "label" | "deadbolt" | "keycard" | "free" | "locked";
  side: "outside" | "inside" | "center" | "both";
  label: string;
  extra?: string;
}

export const LOCK_FUNCTIONS: LockFunction[] = [
  // ── Commercial Functions ──
  {
    code: "F01",
    name: "Passage",
    category: "commercial",
    description: "Non-locking passage function. Both levers are always free to operate. No locking mechanism is present. Ideal for restrooms, corridors, and closets where privacy is not required.",
    elements: [
      { type: "free", side: "outside", label: "Free" },
      { type: "free", side: "inside", label: "Free" },
      { type: "label", side: "center", label: "Always Unlocked" },
    ],
  },
  {
    code: "F02",
    name: "Privacy",
    category: "commercial",
    description: "Push-button privacy lock. Locked from inside by pushing a button. Emergency release on outside (slot or small tool). Used for restrooms, changing rooms, and private offices where a key is not required.",
    elements: [
      { type: "release", side: "outside", label: "Emergency Release" },
      { type: "button", side: "inside", label: "Push Button" },
      { type: "label", side: "center", label: "Privacy Lock" },
    ],
  },
  {
    code: "F04",
    name: "Service Station",
    category: "commercial",
    description: "Key outside, free inside. The outside lever is locked and requires a key to operate. The inside lever is always free for immediate egress. Used for service stations, utility rooms, and back-of-house areas.",
    elements: [
      { type: "key", side: "outside", label: "Key Outside" },
      { type: "locked", side: "outside", label: "Always Locked" },
      { type: "free", side: "inside", label: "Free / Push to Exit" },
    ],
  },
  {
    code: "F05",
    name: "Office",
    category: "commercial",
    description: "Push-button locking with key override. The inside push-button locks the outside lever. A key outside can override the lock. Used for private offices, faculty rooms, and administrative areas.",
    elements: [
      { type: "key", side: "outside", label: "Key Override" },
      { type: "button", side: "inside", label: "Push to Lock" },
      { type: "label", side: "center", label: "Key Override Lock" },
    ],
  },
  {
    code: "F07",
    name: "Classroom",
    category: "commercial",
    description: "Key locks/unlocks outside lever. The outside lever is locked or unlocked by key from the outside. Inside lever is always free. Used for classrooms, lecture halls, and meeting rooms.",
    elements: [
      { type: "key", side: "outside", label: "Key Locks/Unlocks" },
      { type: "free", side: "inside", label: "Free / Push to Exit" },
      { type: "label", side: "center", label: "Classroom Security" },
    ],
  },
  {
    code: "F08",
    name: "Storeroom",
    category: "commercial",
    description: "Always locked outside, free inside. The outside lever is always locked and requires a key. The inside lever is always free for immediate egress. No key is needed to exit. Used for storage rooms, mechanical rooms, and electrical rooms.",
    elements: [
      { type: "key", side: "outside", label: "Key Outside" },
      { type: "locked", side: "outside", label: "Always Locked" },
      { type: "free", side: "inside", label: "Free / Push to Exit" },
      { type: "label", side: "center", label: "Entry & Exit" },
    ],
  },
  {
    code: "F09",
    name: "Dormitory",
    category: "commercial",
    description: "Key inside and outside with key override. Inside lever is free but has a key cylinder for locking. Outside requires key to operate. Used for dormitories, apartment buildings, and multi-tenant housing.",
    elements: [
      { type: "key", side: "outside", label: "Key Outside" },
      { type: "key", side: "inside", label: "Key Inside" },
      { type: "label", side: "center", label: "Key Both Sides" },
    ],
  },
  {
    code: "F10",
    name: "Exit (Panic Hardware)",
    category: "commercial",
    description: "Panic hardware function. The inside is always free (push bar or paddle). The outside may be locked or unlocked with a key. Used on exit doors, emergency exits, and fire-rated doors.",
    elements: [
      { type: "key", side: "outside", label: "Key Outside" },
      { type: "free", side: "inside", label: "Push Bar / Free" },
      { type: "label", side: "center", label: "Panic Exit" },
    ],
  },
  {
    code: "F11",
    name: "Vestibule",
    category: "commercial",
    description: "Key operates both sides. Both outside and inside have key cylinders. Used for vestibules, entryways, and doors between two secure areas.",
    elements: [
      { type: "key", side: "outside", label: "Key Outside" },
      { type: "key", side: "inside", label: "Key Inside" },
      { type: "label", side: "center", label: "Key Both Sides" },
    ],
  },
  {
    code: "F12",
    name: "Dummy (Non-Functional)",
    category: "commercial",
    description: "Non-functional trim. The lever is fixed and does not operate a latch. Used for double-door sets where one leaf is inactive, or for decorative applications.",
    elements: [
      { type: "label", side: "center", label: "Non-Functional Trim" },
      { type: "label", side: "both", label: "Fixed — No Latch" },
    ],
  },
  {
    code: "F13",
    name: "Communicating",
    category: "commercial",
    description: "Keyed both sides with turn piece. Both sides have a key cylinder. A turn piece on each side allows locking/unlocking without a key. Used for communicating doors between offices or rooms.",
    elements: [
      { type: "key", side: "outside", label: "Key Outside" },
      { type: "thumbturn", side: "outside", label: "Turn Outside" },
      { type: "key", side: "inside", label: "Key Inside" },
      { type: "thumbturn", side: "inside", label: "Turn Inside" },
      { type: "label", side: "center", label: "Key & Turn Both Sides" },
    ],
  },
  {
    code: "F14",
    name: "Entry",
    category: "commercial",
    description: "Key outside, thumb turn inside. The outside has a key cylinder. The inside has a thumb turn to lock/unlock. Used for main entrances, exterior doors, and apartment doors.",
    elements: [
      { type: "key", side: "outside", label: "Key Outside" },
      { type: "thumbturn", side: "inside", label: "Thumb Turn Inside" },
      { type: "label", side: "center", label: "Entry Lock" },
    ],
  },
  {
    code: "F16",
    name: "Dummy Trim (Keyed)",
    category: "commercial",
    description: "Keyed dummy trim. The lever is fixed but includes a key cylinder for aesthetic matching. Used on inactive doors in pairs where a matching keyed look is desired.",
    elements: [
      { type: "key", side: "outside", label: "Key Cylinder" },
      { type: "label", side: "center", label: "Fixed Lever" },
      { type: "label", side: "both", label: "Non-Operating" },
    ],
  },
  {
    code: "F17",
    name: "Dormitory Privacy",
    category: "commercial",
    description: "Privacy lock with emergency release from outside. Push-button privacy on inside with an emergency release from the outside. Used for dormitory bedrooms and suite entrances.",
    elements: [
      { type: "release", side: "outside", label: "Emergency Release" },
      { type: "button", side: "inside", label: "Push Button" },
      { type: "label", side: "center", label: "Privacy + Emergency" },
    ],
  },
  {
    code: "F22",
    name: "Hotel / Guest",
    category: "commercial",
    description: "Key card outside, inside lock. Electronic key card reader on outside. Inside has a thumb turn or deadbolt for privacy. Used for hotel guest rooms, meeting rooms, and access-controlled areas.",
    elements: [
      { type: "keycard", side: "outside", label: "Key Card Reader" },
      { type: "thumbturn", side: "inside", label: "Privacy Lock" },
      { type: "deadbolt", side: "center", label: "Deadbolt" },
      { type: "label", side: "center", label: "Hotel Function" },
    ],
  },
  {
    code: "F24",
    name: "Classroom Security",
    category: "commercial",
    description: "Classroom security lock. Key outside locks or unlocks the outside lever. Inside lever is always free. The inside can lock the door without a key (push-button or turn). Used for modern classroom security requirements.",
    elements: [
      { type: "key", side: "outside", label: "Key Locks/Unlocks" },
      { type: "button", side: "inside", label: "Lock Inside" },
      { type: "free", side: "inside", label: "Free to Exit" },
      { type: "label", side: "center", label: "Classroom Security" },
    ],
  },
  // ── Electric Functions ──
  {
    code: "F25",
    name: "Electric Latch Retraction",
    category: "electric",
    description: "Electric latch retraction (ELR). The latch is retracted by an electric signal. Used with access control systems, automatic doors, and fire alarm integration. Fail-safe or fail-secure options available.",
    elements: [
      { type: "label", side: "outside", label: "Electric Release" },
      { type: "free", side: "inside", label: "Free / Push to Exit" },
      { type: "label", side: "center", label: "Electric Latch Retraction" },
    ],
  },
  {
    code: "F26",
    name: "Electric Locking",
    category: "electric",
    description: "Electric locking function. The lock is engaged or disengaged by an electric signal. Used for access-controlled doors, remote locking, and integrated security systems.",
    elements: [
      { type: "keycard", side: "outside", label: "Access Control" },
      { type: "free", side: "inside", label: "Free / Push to Exit" },
      { type: "label", side: "center", label: "Electric Lock" },
    ],
  },
  {
    code: "F27",
    name: "Electrified Panic Exit",
    category: "electric",
    description: "Electrified panic exit device. The push bar is normally locked and releases on signal or when pushed. Used for fire-rated exits with access control integration.",
    elements: [
      { type: "label", side: "outside", label: "Electrified" },
      { type: "free", side: "inside", label: "Push Bar / Exit" },
      { type: "label", side: "center", label: "Electrified Panic Exit" },
    ],
  },
  {
    code: "F28",
    name: "Stairwell / Re-Entry",
    category: "electric",
    description: "Stairwell re-entry function. Allows re-entry from stairwell side after exit. Electrically controlled to meet fire code requirements for stairwell doors.",
    elements: [
      { type: "keycard", side: "outside", label: "Re-Entry Control" },
      { type: "free", side: "inside", label: "Free / Exit" },
      { type: "label", side: "center", label: "Stairwell Re-Entry" },
    ],
  },
  // ── Residential Functions ──
  {
    code: "R01",
    name: "Passage (Residential)",
    category: "residential",
    description: "Non-locking passage function. Both knobs or levers are always free. Used for hallways, closets, and doors between rooms where locking is not needed.",
    elements: [
      { type: "free", side: "outside", label: "Free" },
      { type: "free", side: "inside", label: "Free" },
      { type: "label", side: "center", label: "Always Unlocked" },
    ],
  },
  {
    code: "R02",
    name: "Privacy (Residential)",
    category: "residential",
    description: "Privacy lock with emergency release. Locked from inside by a push button or turn button. An emergency release slot on the outside allows unlocking. Used for bedrooms and bathrooms.",
    elements: [
      { type: "release", side: "outside", label: "Emergency Release" },
      { type: "button", side: "inside", label: "Push to Lock" },
      { type: "label", side: "center", label: "Privacy Lock" },
    ],
  },
  {
    code: "R03",
    name: "Entry (Residential)",
    category: "residential",
    description: "Key outside, thumb turn or turn button inside. Used for exterior doors — front doors, back doors, and garage entry doors. The inside turn can lock/unlock without a key.",
    elements: [
      { type: "key", side: "outside", label: "Key Outside" },
      { type: "thumbturn", side: "inside", label: "Thumb Turn Inside" },
      { type: "deadbolt", side: "center", label: "Deadbolt" },
      { type: "label", side: "center", label: "Entry Lock" },
    ],
  },
  {
    code: "R04",
    name: "Dummy (Residential)",
    category: "residential",
    description: "Non-functional dummy trim. Fixed knob or lever that does not operate a latch. Used for inactive doors in double-door sets or decorative applications.",
    elements: [
      { type: "label", side: "center", label: "Non-Functional" },
      { type: "label", side: "both", label: "Fixed — No Latch" },
    ],
  },
];

/**
 * Generate an SVG door diagram string for a given lock function.
 * Uses a front-elevation door view.
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

  // Element positions
  const leftCol = doorX + 50;
  const rightCol = doorX + doorW - 50;
  const midCol = centerLine;

  function getPos(side: "outside" | "inside" | "center" | "both"): { x: number; y: number } {
    const baseY = doorY + 80;
    if (side === "outside") return { x: leftCol, y: baseY };
    if (side === "inside") return { x: rightCol, y: baseY };
    if (side === "both") return { x: midCol, y: baseY + 30 };
    return { x: midCol, y: baseY + 20 };
  }

  let yOffset = 0;
  const usedY = new Set<number>();

  function nextY(side: "outside" | "inside" | "center" | "both"): number {
    const base = getPos(side).y;
    let y = base;
    while (usedY.has(y)) y += 32;
    usedY.add(y);
    return y;
  }

  // SVG building
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">`;

  // Door frame
  svg += `<rect x="${doorX}" y="${doorY}" width="${doorW}" height="${doorH}" rx="4" fill="#f0f0f0" stroke="#333" stroke-width="2"/>`;

  // Center line dividing outside/inside
  svg += `<line x1="${centerLine}" y1="${doorY + 4}" x2="${centerLine}" y2="${doorY + doorH - 4}" stroke="#999" stroke-width="1" stroke-dasharray="6,4"/>`;

  // Labels for outside/inside
  svg += `<text x="${doorX + 20}" y="${doorY + 24}" font-size="11" fill="#666" font-family="Arial, sans-serif">OUTSIDE</text>`;
  svg += `<text x="${doorX + doorW - 70}" y="${doorY + 24}" font-size="11" fill="#666" font-family="Arial, sans-serif">INSIDE</text>`;

  // Door header - function code
  svg += `<text x="${midX}" y="${doorY + doorH - 10}" text-anchor="middle" font-size="12" fill="#999" font-family="Arial, sans-serif">Door Elevation — Outside (Left) / Inside (Right)</text>`;

  // Draw elements
  for (const el of fn.elements) {
    const y = nextY(el.side);
    let x: number;
    if (el.side === "outside") x = leftCol;
    else if (el.side === "inside") x = rightCol;
    else if (el.side === "both") x = midCol;
    else x = midCol;

    // Draw icon
    const iconSize = 18;
    const iconX = x - iconSize / 2;
    const iconY = y - 12;

    if (el.type === "key") {
      // Key icon — circle with rectangle
      svg += `<circle cx="${x}" cy="${y - 6}" r="${6}" fill="none" stroke="#333" stroke-width="1.5"/>`;
      svg += `<rect x="${x - 1.5}" y="${y - 6}" width="3" height="10" fill="#333"/>`;
      svg += `<rect x="${x - 0.5}" y="${y + 2}" width="1" height="4" fill="#333"/>`;
    } else if (el.type === "button") {
      // Push button — rounded rect
      svg += `<rect x="${x - 8}" y="${y - 14}" width="16" height="12" rx="4" fill="#555" stroke="#333" stroke-width="1.5"/>`;
      svg += `<text x="${x}" y="${y - 5}" text-anchor="middle" font-size="8" fill="white" font-family="Arial, sans-serif">P</text>`;
    } else if (el.type === "thumbturn") {
      // Thumb turn — small circle with line
      svg += `<circle cx="${x}" cy="${y - 8}" r="7" fill="none" stroke="#333" stroke-width="1.5"/>`;
      svg += `<line x1="${x - 4}" y1="${y - 8}" x2="${x + 4}" y2="${y - 8}" stroke="#333" stroke-width="2"/>`;
    } else if (el.type === "release") {
      // Emergency release — small slot
      svg += `<rect x="${x - 6}" y="${y - 14}" width="12" height="10" rx="1" fill="none" stroke="#333" stroke-width="1.5"/>`;
      svg += `<text x="${x}" y="${y - 6}" text-anchor="middle" font-size="7" fill="#333" font-family="Arial, sans-serif">⌕</text>`;
    } else if (el.type === "deadbolt") {
      // Deadbolt — rectangle
      svg += `<rect x="${x - 6}" y="${y - 14}" width="12" height="16" rx="2" fill="#555" stroke="#333" stroke-width="1.5"/>`;
    } else if (el.type === "keycard") {
      // Key card — card shape
      svg += `<rect x="${x - 8}" y="${y - 12}" width="16" height="10" rx="2" fill="none" stroke="#333" stroke-width="1.5"/>`;
      svg += `<line x1="${x - 4}" y1="${y - 8}" x2="${x + 4}" y2="${y - 8}" stroke="#333" stroke-width="1"/>`;
      svg += `<line x1="${x - 4}" y1="${y - 5}" x2="${x + 2}" y2="${y - 5}" stroke="#333" stroke-width="1"/>`;
    } else if (el.type === "free") {
      // Free — checkmark
      svg += `<text x="${x}" y="${y - 4}" text-anchor="middle" font-size="14" fill="#2e7d32" font-family="Arial, sans-serif">✓</text>`;
    } else if (el.type === "locked") {
      // Locked — lock icon
      svg += `<rect x="${x - 6}" y="${y - 8}" width="12" height="10" rx="2" fill="none" stroke="#d32f2f" stroke-width="1.5"/>`;
      svg += `<path d="M${x - 4},${y - 8} L${x - 4},${y - 14} A4,4 0 0,1 ${x + 4},${y - 14} L${x + 4},${y - 8}" fill="none" stroke="#d32f2f" stroke-width="1.5"/>`;
    }

    // Label text
    if (el.type === "free" || el.type === "locked") {
      // Label below icon
      svg += `<text x="${x}" y="${y + 10}" text-anchor="middle" font-size="8" fill="${el.type === 'locked' ? '#d32f2f' : '#2e7d32'}" font-family="Arial, sans-serif">${el.label}</text>`;
    } else {
      svg += `<text x="${x}" y="${y + 10}" text-anchor="middle" font-size="8" fill="#333" font-family="Arial, sans-serif">${el.label}</text>`;
    }
  }

  svg += `</svg>`;
  return svg;
}