/**
 * Calendar source colours.
 *
 * A provider that publishes its own calendar colour (iCloud does) gets the closest entry in
 * Navet's palette rather than its raw value, so the card keeps one coherent set of colours across
 * providers. Sources without a colour fall back to their position in the list, which is how every
 * calendar behaved before.
 */

interface PaletteEntry {
  className: string;
  rgb: [number, number, number];
}

// Tailwind 500-level colours. The first five are the historical rotation; the rest exist so a
// provider palette as wide as Apple's does not collapse onto three swatches.
const PALETTE: PaletteEntry[] = [
  { className: 'bg-blue-500', rgb: [59, 130, 246] },
  { className: 'bg-purple-500', rgb: [168, 85, 247] },
  { className: 'bg-green-500', rgb: [34, 197, 94] },
  { className: 'bg-orange-500', rgb: [249, 115, 22] },
  { className: 'bg-indigo-500', rgb: [99, 102, 241] },
  { className: 'bg-red-500', rgb: [239, 68, 68] },
  { className: 'bg-amber-500', rgb: [245, 158, 11] },
  { className: 'bg-yellow-500', rgb: [234, 179, 8] },
  { className: 'bg-teal-500', rgb: [20, 184, 166] },
  { className: 'bg-pink-500', rgb: [236, 72, 153] },
];

export const CALENDAR_SOURCE_COLOR_CLASSES = PALETTE.slice(0, 5).map(
  (entry) => entry.className
) as readonly string[];

/** Resolve a source's colour class, preferring its own colour over its position. */
export function resolveCalendarSourceColor(accentColor: string | undefined, index: number): string {
  return (
    snapToPalette(accentColor) ??
    CALENDAR_SOURCE_COLOR_CLASSES[index % CALENDAR_SOURCE_COLOR_CLASSES.length]
  );
}

function snapToPalette(accentColor: string | undefined): string | null {
  const rgb = parseHexColor(accentColor);
  if (!rgb) {
    return null;
  }

  let closest = PALETTE[0];
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const entry of PALETTE) {
    const distance = colorDistance(rgb, entry.rgb);
    if (distance < closestDistance) {
      closest = entry;
      closestDistance = distance;
    }
  }

  return closest.className;
}

export function parseHexColor(value: string | undefined): [number, number, number] | null {
  if (typeof value !== 'string') {
    return null;
  }

  // Apple appends an alpha byte; it is always opaque, so only the first three matter.
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})(?:[0-9a-f]{2})?$/i.exec(value.trim());
  if (!match) {
    return null;
  }

  return [
    Number.parseInt(match[1], 16),
    Number.parseInt(match[2], 16),
    Number.parseInt(match[3], 16),
  ];
}

/**
 * Redmean distance: plain RGB distance puts Apple's red next to its purple often enough to be
 * visibly wrong, and this approximates perceived difference closely enough for nine swatches.
 */
function colorDistance(left: [number, number, number], right: [number, number, number]): number {
  const meanRed = (left[0] + right[0]) / 2;
  const deltaRed = left[0] - right[0];
  const deltaGreen = left[1] - right[1];
  const deltaBlue = left[2] - right[2];

  return (
    (2 + meanRed / 256) * deltaRed * deltaRed +
    4 * deltaGreen * deltaGreen +
    (2 + (255 - meanRed) / 256) * deltaBlue * deltaBlue
  );
}
