// Dependency-free Code128 barcode → inline SVG. No npm package required, so it
// prints reliably from any browser. Numeric values use Code128-C (2 digits per
// symbol) so long numeric IDs stay physically compact and reliably scannable;
// everything else falls back to Code128-B (ASCII 32–126).

// Standard Code128 module-width patterns (index 0–106) — the same table is
// shared by subsets A/B/C per the Code128 spec; only the *meaning* of each
// symbol value differs by subset. Each string is the width (in modules) of
// consecutive bar/space/bar/space… starting with a bar.
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_B = 104;
const START_C = 105;
const STOP = 106;

// Checksum + framing shared by both subsets: (start + Σ symbol_i * position_i) mod 103.
function withChecksum(startValue, symbolValues) {
  let sum = startValue;
  symbolValues.forEach((v, i) => { sum += v * (i + 1); });
  return [startValue, ...symbolValues, sum % 103, STOP];
}

// Code128-B: one symbol per ASCII character (32–126).
function encode128B(text) {
  const clean = String(text).replace(/[^\x20-\x7E]/g, '');
  const symbolValues = [...clean].map((ch) => ch.charCodeAt(0) - 32);
  return withChecksum(START_B, symbolValues);
}

// Code128-C: one symbol per PAIR of digits (00–99) — roughly half the width
// of Code128-B for the same numeric value, which is what keeps long IDs
// (auto-generated serials, barcodes, etc.) reliably scannable on a small label.
function encode128C(digits) {
  const padded = digits.length % 2 === 0 ? digits : '0' + digits; // even length required
  const symbolValues = [];
  for (let i = 0; i < padded.length; i += 2) symbolValues.push(Number(padded.slice(i, i + 2)));
  return withChecksum(START_C, symbolValues);
}

function encodeValue(value) {
  const str = String(value);
  return /^[0-9]+$/.test(str) ? encode128C(str) : encode128B(str);
}

export default function Barcode({ value, height = 46, moduleWidth = 1.6, showText = true, className = '' }) {
  if (!value) return null;
  const pattern = encodeValue(value).map((v) => PATTERNS[v]).join('');
  const rects = [];
  let x = 0;
  let isBar = true;
  for (const ch of pattern) {
    const w = parseInt(ch, 10) * moduleWidth;
    if (isBar) rects.push(<rect key={x} x={x} y={0} width={w} height={height} fill="#000" />);
    x += w;
    isBar = !isBar;
  }
  const width = x;
  const textH = showText ? 12 : 0;
  return (
    <svg
      className={className}
      width={width}
      height={height + textH}
      viewBox={`0 0 ${width} ${height + textH}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', maxWidth: '100%' }}
    >
      {rects}
      {showText && (
        <text x={width / 2} y={height + 10} textAnchor="middle" fontSize="11" fontFamily="monospace" fill="#000">
          {value}
        </text>
      )}
    </svg>
  );
}
