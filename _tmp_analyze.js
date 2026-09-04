const { CONTENIDOS, CONTENIDOS_ESPECIALES } = require('./_tmp_seed_copy.js');
const count = (s) => (s || '').length;
const words = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;
const paras = (s) => (s || '').split(/\n\s*\n/).filter(p => p.trim()).length;

const rows = CONTENIDOS.map(c => {
  const dl = c.datos_leccion || {};
  const ej = dl.ejercicio || {};
  const campos = (c.campos_respuesta || []).length;
  const sups = (dl.suplementacion || []).length;
  const contenidoLen = count(dl.contenido);
  const conceptoLen = count(dl.concepto);
  const principioLen = count(dl.principio);
  const instruccionLen = count(ej.instruccion);
  const pasosLen = (ej.pasos || []).reduce((a, p) => a + count(p.texto), 0);
  const total = contenidoLen + conceptoLen + principioLen + instruccionLen + pasosLen;
  return {
    dia: c.dia_numero,
    titulo: (c.titulo_modulo || '').replace(/^D\u00eda \d+:\s*/, ''),
    bloque: Math.ceil(c.dia_numero / 5),
    total, contenidoLen, conceptoLen, principioLen, instruccionLen, pasosLen,
    palabrasContenido: words(dl.contenido),
    parrafosContenido: paras(dl.contenido),
    tieneSaltos: /\n\s*\n/.test(dl.contenido || ''),
    campos, sups,
    pasos: (ej.pasos || []).length,
  };
});

rows.sort((a,b) => b.total - a.total);
console.log('=== DIAS ORDENADOS POR VOLUMEN TOTAL DE TEXTO (chars) ===');
for (const r of rows) {
  console.log(`D${String(r.dia).padStart(2)} | total=${String(r.total).padStart(5)} | cont=${String(r.contenidoLen).padStart(4)} (${String(r.palabrasContenido).padStart(3)}p, ${r.parrafosContenido}par, saltos=${r.tieneSaltos?1:0}) | conc=${String(r.conceptoLen).padStart(3)} | princ=${String(r.principioLen).padStart(3)} | ejerc=${String(r.instruccionLen).padStart(3)} | pasos=${r.pasos}/${r.pasosLen} | campos=${r.campos} | supl=${r.sups} | ${r.titulo.slice(0,45)}`);
}
const totales = rows.map(r=>r.total);
console.log('\nMedia total:', Math.round(totales.reduce((a,b)=>a+b,0)/rows.length));
console.log('Sin saltos de parrafo en contenido:', rows.filter(r=>!r.tieneSaltos && r.contenidoLen>800).map(r=>r.dia).join(', '));
console.log('\n=== CONTENIDOS_ESPECIALES ===');
for (const ce of CONTENIDOS_ESPECIALES) {
  const t = count(ce.contenido) + count(ce.cuerpo) + JSON.stringify(ce).length;
  console.log(ce.tipo, '| keys:', Object.keys(ce).join(','), '| ~len:', t);
}

