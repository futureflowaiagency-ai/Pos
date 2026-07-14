// Dependency-free Code128-B barcode → inline SVG. No npm package required, so it
// prints reliably from any browser. Handles ASCII 32–126 (digits, letters, symbols).

// Standard Code128 module-width patterns (index 0–106). Each string is the width
// (in modules) of consecutive bar/space/bar/space… starting with a bar.
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
const STOP = 106;

// Encode a string to the full concatenated module pattern.
function encode128B(text) {
  const clean = String(text).replace(/[^\x20-\x7E]/g, '');
  const values = [START_B];
  let sum = START_B;
  for (let i = 0; i < clean.length; i++) {
    const v = clean.charCodeAt(i) - 32;
    values.push(v);
    sum += v * (i + 1);
  }
  values.push(sum % 103); // checksum
  values.push(STOP);
  return values.map((v) => PATTERNS[v]).join('');
}

export default function Barcode({ value, height = 46, moduleWidth = 1.6, showText = true, className = '' }) {
  if (!value) return null;
  const pattern = encode128B(value);
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
