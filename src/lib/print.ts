/**
 * Converts modern CSS colors (oklch, oklab, lab, lch) to browser-compatible RGB strings
 * Fixes html2canvas black rectangle rendering issues in Tailwind v4
 */
export function convertColorToRgb(colorStr: string): string {
  if (!colorStr || colorStr === 'transparent' || colorStr === 'inherit' || colorStr === 'initial') {
    return colorStr;
  }

  // 1. Native Canvas 2D resolver (works if browser supports assigning color to fillStyle)
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ffffff'; // baseline reset
      ctx.fillStyle = colorStr;
      const res = ctx.fillStyle;
      if (res && res !== '#ffffff' && !res.includes('oklch') && !res.includes('oklab')) {
        return res;
      }
    }
  } catch {}

  // 2. Pure Math Fallback for OKLCH: oklch(L C H [/ A])
  const oklchMatch = colorStr.match(/oklch\(\s*([\d.%]+)\s+([\d.%]+)\s+([\d.%]+)(?:\s*\/\s*([\d.%]+))?\s*\)/i);
  if (oklchMatch) {
    let l = oklchMatch[1].endsWith('%') ? parseFloat(oklchMatch[1]) / 100 : parseFloat(oklchMatch[1]);
    let c = oklchMatch[2].endsWith('%') ? parseFloat(oklchMatch[2]) / 100 : parseFloat(oklchMatch[2]);
    let h = parseFloat(oklchMatch[3]);
    let a = oklchMatch[4] ? (oklchMatch[4].endsWith('%') ? parseFloat(oklchMatch[4]) / 100 : parseFloat(oklchMatch[4])) : 1;

    const hRad = (h * Math.PI) / 180;
    const aLab = c * Math.cos(hRad);
    const bLab = c * Math.sin(hRad);

    const l_ = l + 0.3963377774 * aLab + 0.2158037573 * bLab;
    const m_ = l - 0.1055613458 * aLab - 0.0638541728 * bLab;
    const s_ = l - 0.0894841775 * aLab - 1.2914855480 * bLab;

    const l3 = l_ * l_ * l_;
    const m3 = m_ * m_ * m_;
    const s3 = s_ * s_ * s_;

    let rLinear = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    let gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    let bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

    const toSRGB = (val: number) => {
      val = Math.max(0, Math.min(1, val));
      return val <= 0.0031308 ? 12.92 * val : 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
    };

    const r = Math.round(toSRGB(rLinear) * 255);
    const g = Math.round(toSRGB(gLinear) * 255);
    const b = Math.round(toSRGB(bLinear) * 255);

    if (a < 1) return `rgba(${r}, ${g}, ${b}, ${a})`;
    return `rgb(${r}, ${g}, ${b})`;
  }

  // 3. Pure Math Fallback for OKLAB: oklab(L a b [/ A])
  const oklabMatch = colorStr.match(/oklab\(\s*([\d.%]+)\s+([\d.-]+)\s+([\d.-]+)(?:\s*\/\s*([\d.%]+))?\s*\)/i);
  if (oklabMatch) {
    let l = oklabMatch[1].endsWith('%') ? parseFloat(oklabMatch[1]) / 100 : parseFloat(oklabMatch[1]);
    let aLab = parseFloat(oklabMatch[2]);
    let bLab = parseFloat(oklabMatch[3]);
    let a = oklabMatch[4] ? (oklabMatch[4].endsWith('%') ? parseFloat(oklabMatch[4]) / 100 : parseFloat(oklabMatch[4])) : 1;

    const l_ = l + 0.3963377774 * aLab + 0.2158037573 * bLab;
    const m_ = l - 0.1055613458 * aLab - 0.0638541728 * bLab;
    const s_ = l - 0.0894841775 * aLab - 1.2914855480 * bLab;

    const l3 = l_ * l_ * l_;
    const m3 = m_ * m_ * m_;
    const s3 = s_ * s_ * s_;

    let rLinear = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
    let gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
    let bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

    const toSRGB = (val: number) => {
      val = Math.max(0, Math.min(1, val));
      return val <= 0.0031308 ? 12.92 * val : 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
    };

    const r = Math.round(toSRGB(rLinear) * 255);
    const g = Math.round(toSRGB(gLinear) * 255);
    const b = Math.round(toSRGB(bLinear) * 255);

    if (a < 1) return `rgba(${r}, ${g}, ${b}, ${a})`;
    return `rgb(${r}, ${g}, ${b})`;
  }

  return colorStr;
}

/**
 * Utility to reliably trigger browser print / PDF export
 * Handles clearing modal scroll-clipping and overflow restrictions
 */
export function triggerPrint() {
  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = 'visible';
  document.body.classList.add('is-printing');

  // Short delay to ensure DOM and CSS render printable layout
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      document.body.classList.remove('is-printing');
      document.body.style.overflow = originalOverflow;
    }, 500);
  }, 150);
}

