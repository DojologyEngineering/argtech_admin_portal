/**
 * Phase 1 stores no real files. Photos and sample documents are generated
 * placeholder images, the same ones the Agent App uses, so the UI has something
 * to show and nothing large lands in localStorage.
 */

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function placeholderImage(label: string, options?: { sample?: boolean }): string {
  const text = escapeXml(label.length > 22 ? `${label.slice(0, 20)}…` : label);
  const sample = options?.sample
    ? `<text x="160" y="105" text-anchor="middle" font-family="sans-serif" font-size="26" font-weight="800" fill="#b42318" transform="rotate(-14 160 105)">SAMPLE CERTIFICATE</text>`
    : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="210" viewBox="0 0 320 210">` +
    `<rect width="320" height="210" fill="#eaf5ee"/>` +
    `<rect x="10" y="10" width="300" height="190" rx="10" fill="none" stroke="#6bb68c" stroke-width="2" stroke-dasharray="6 5"/>` +
    sample +
    `<text x="160" y="${options?.sample ? 160 : 112}" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#045523">${text}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
