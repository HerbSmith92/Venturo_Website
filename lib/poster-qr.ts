import QRCode from "qrcode";

const INK = "#2A2D35";

function alignmentCenters(version: number, size: number) {
  if (version < 2) return [] as Array<[number, number]>;
  const posCount = Math.floor(version / 7) + 2;
  const intervals = size === 145 ? 26 : Math.ceil((size - 13) / (2 * posCount - 2)) * 2;
  const positions = [size - 7];
  for (let i = 1; i < posCount - 1; i += 1) positions[i] = positions[i - 1] - intervals;
  positions.push(6);
  positions.reverse();
  const coords: Array<[number, number]> = [];
  const count = positions.length;
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      const corner =
        (row === 0 && col === 0) ||
        (row === 0 && col === count - 1) ||
        (row === count - 1 && col === 0);
      if (corner) continue;
      coords.push([positions[row], positions[col]]);
    }
  }
  return coords;
}

function inFinder(row: number, col: number, size: number) {
  return (
    (row < 7 && col < 7) ||
    (row < 7 && col >= size - 7) ||
    (row >= size - 7 && col < 7)
  );
}

function inAlignment(row: number, col: number, centers: Array<[number, number]>) {
  return centers.some(([centerRow, centerCol]) => {
    return Math.abs(row - centerRow) <= 2 && Math.abs(col - centerCol) <= 2;
  });
}

function finder(x: number, y: number) {
  return [
    `<rect x="${x}" y="${y}" width="7" height="7" rx="1.65" fill="${INK}"/>`,
    `<rect x="${x + 1}" y="${y + 1}" width="5" height="5" rx="1.05" fill="#fff"/>`,
    `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="0.7" fill="${INK}"/>`,
  ].join("");
}

function alignment(row: number, col: number) {
  const x = col - 2;
  const y = row - 2;
  return [
    `<rect x="${x}" y="${y}" width="5" height="5" rx="1.15" fill="${INK}"/>`,
    `<rect x="${x + 1}" y="${y + 1}" width="3" height="3" rx="0.7" fill="#fff"/>`,
    `<circle cx="${col + 0.5}" cy="${row + 0.5}" r="0.55" fill="${INK}"/>`,
  ].join("");
}

/** Dot-module QR with rounded finder marks, matching the partner poster artwork. */
export function posterQrSrc(value: string) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "H" });
  const size = qr.modules.size;
  const quiet = 2;
  const total = size + quiet * 2;
  const centers = alignmentCenters(qr.version, size);
  const dots: string[] = [];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (!qr.modules.get(row, col)) continue;
      if (inFinder(row, col, size) || inAlignment(row, col, centers)) continue;
      dots.push(
        `<circle cx="${(quiet + col + 0.5).toFixed(2)}" cy="${(quiet + row + 0.5).toFixed(2)}" r="0.36" fill="${INK}"/>`,
      );
    }
  }

  const marks = [
    finder(quiet, quiet),
    finder(quiet + size - 7, quiet),
    finder(quiet, quiet + size - 7),
    ...centers.map(([row, col]) => alignment(quiet + row, quiet + col)),
  ].join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="geometricPrecision"><rect width="100%" height="100%" fill="#fff"/>${marks}${dots.join("")}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
