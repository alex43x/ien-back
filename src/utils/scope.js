function enScope(id, tiendasPermitidas) {
  if (!tiendasPermitidas) return true;
  if (id == null) return false;
  return tiendasPermitidas.some(t => t != null && t.toString() === id.toString());
}

module.exports = { enScope };
