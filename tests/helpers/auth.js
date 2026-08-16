const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('../../src/models/index');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

function generateToken(usuario) {
  return jwt.sign({ id: usuario._id }, JWT_SECRET, { expiresIn: '15m' });
}

async function createUsuario(overrides = {}) {
  const Usuario = mongoose.model('Usuario');
  const defaults = {
    nombre: 'Test User',
    email: `test-${Date.now()}@example.com`,
    password_hash: await bcrypt.hash('password123', 4),
    rol: 'usuario',
    fecha_registro: new Date()
  };
  return Usuario.create({ ...defaults, ...overrides });
}

async function createAdmin(overrides = {}) {
  return createUsuario({
    nombre: 'Admin General',
    email: `admin-${Date.now()}@example.com`,
    rol: 'admin_general',
    ...overrides
  });
}

async function createAdminNegocio(tiendas = [], overrides = {}) {
  return createUsuario({
    nombre: 'Admin Negocio',
    email: `admin-neg-${Date.now()}@example.com`,
    rol: 'admin_negocio',
    tiendas_administradas: tiendas,
    ...overrides
  });
}

async function createModerador(tiendaId, overrides = {}) {
  return createUsuario({
    nombre: 'Moderador',
    email: `mod-${Date.now()}@example.com`,
    rol: 'moderador_tienda',
    tienda_moderada: tiendaId,
    ...overrides
  });
}

module.exports = { generateToken, createUsuario, createAdmin, createAdminNegocio, createModerador };
