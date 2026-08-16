function toResponse(doc) {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const { _id, ...rest } = obj;
  return { id: _id, ...rest };
}

module.exports = { toResponse };
