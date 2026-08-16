const C = {
  gold: "#F0BC48",
  teal: "#6DBFAA",
  red: "#E96B6B",
  text: "#3E3A38",
  muted: "#7A7270",
  bg: "#F7F5F4",
  secondary: "#F0EDEC",
  white: "#FFFFFF",
  border: "rgba(62,58,56,0.1)",
};

const FONT = {
  lora: "'Lora', Georgia, 'Times New Roman', serif",
  inter: "'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  mono: "'DM Mono', 'Courier New', monospace",
};

function wrap(body) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Inter:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    body { margin:0; padding:0; background:${C.bg}; font-family:${FONT.inter}; color:${C.text}; -webkit-font-smoothing:antialiased; }
    img { border:0; display:block; }
  </style>
</head>
<body>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        ${body}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function header() {
  return `
  <tr>
    <td style="padding:24px 32px;background:${C.white};border-radius:16px 16px 0 0;border-bottom:1px solid ${C.border};">
      <p style="margin:0;font-family:${FONT.mono};font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${C.muted};font-weight:500;">IEN — Inteligencia Emocional</p>
    </td>
  </tr>`;
}

function footer() {
  return `
  <tr>
    <td style="padding:24px 32px;background:${C.white};border-radius:0 0 16px 16px;border-top:1px solid ${C.border};">
      <p style="margin:0;font-family:${FONT.inter};font-size:12px;color:${C.muted};text-align:center;font-weight:400;">Cuidamos de tu mente y de tu corazón</p>
    </td>
  </tr>`;
}

function card(content, accent) {
  accent = accent || C.gold;
  return `
  <tr>
    <td style="padding:0 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.white};border-radius:16px;border:1px solid ${C.border};overflow:hidden;">
        <tr><td style="border-left:4px solid ${accent};padding:32px;">
          ${content}
        </td></tr>
      </table>
    </td>
  </tr>`;
}

function spacer(px) {
  px = px || 16;
  return `<tr><td style="height:${px}px;"></td></tr>`;
}

function btn(label, href, bg) {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
    <tr>
      <td style="background:${bg};border-radius:12px;padding:14px 32px;">
        <a href="${href}" style="font-family:${FONT.inter};font-size:14px;font-weight:600;color:${C.white};text-decoration:none;letter-spacing:0.01em;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function label(text, color) {
  return `<p style="margin:0 0 4px;font-family:${FONT.mono};font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${color};font-weight:500;">${text}</p>`;
}

function title(text) {
  return `<h1 style="margin:0 0 16px;font-family:${FONT.lora};font-size:22px;font-weight:600;color:${C.text};line-height:1.4;">${text}</h1>`;
}

function body(text) {
  return `<p style="margin:0 0 16px;font-family:${FONT.inter};font-size:15px;color:${C.text};line-height:1.7;font-weight:400;">${text}</p>`;
}

function signoff(tienda) {
  return `
  <p style="margin:0;font-family:${FONT.inter};font-size:15px;color:${C.text};line-height:1.7;">
    Con cariño,<br/>
    <span style="font-weight:500;">Equipo IEN${tienda ? ' \u00B7 ' + tienda : ''}</span>
  </p>`;
}

function brandFooter() {
  const base = process.env.FRONTEND_URL || 'https://ien.app';
  return `
  <tr>
    <td style="padding:16px 32px 8px;background:${C.white};">
      <p style="margin:0 0 12px;font-family:${FONT.inter};font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:${C.muted};text-align:center;font-weight:500;">Con el apoyo de</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding-bottom:8px;">
            <img src="${base}/imports/cardiosmile.jpeg" alt="Cardiosmile" style="height:60px;width:auto;border-radius:12px;display:inline-block;" />
            <div style="display:inline-block;width:1px;height:48px;background:${C.border};margin:0 20px;vertical-align:middle;"></div>
            <img src="${base}/imports/vitamin_shoppe.jpeg" alt="Vitamin Shoppe" style="height:60px;width:auto;border-radius:12px;display:inline-block;" />
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:8px 32px 24px;background:${C.white};border-radius:0 0 16px 16px;border-top:1px solid ${C.border};">
      <p style="margin:0;font-family:${FONT.inter};font-size:12px;color:${C.muted};text-align:center;font-weight:400;">Cuidamos de tu mente y de tu coraz\u00F3n</p>
    </td>
  </tr>`;
}

module.exports = { C, FONT, wrap, header, footer, brandFooter, card, spacer, btn, label, title, body, signoff };
