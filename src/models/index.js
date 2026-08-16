require('./Usuario');
require('./Tienda');
require('./Producto');
require('./Codigo');
require('./PlanProgreso');
require('./ContenidoDiario');
require('./ContenidoEspecial');
require('./TestPregunta');
require('./RefreshToken');
require('./PasswordResetToken');
require('./HistorialCorreo');

module.exports = {
  Usuario: require('./Usuario'),
  Tienda: require('./Tienda'),
  Producto: require('./Producto'),
  Codigo: require('./Codigo'),
  PlanProgreso: require('./PlanProgreso'),
  ContenidoDiario: require('./ContenidoDiario'),
  ContenidoEspecial: require('./ContenidoEspecial'),
  TestPregunta: require('./TestPregunta'),
  RefreshToken: require('./RefreshToken'),
  PasswordResetToken: require('./PasswordResetToken'),
  HistorialCorreo: require('./HistorialCorreo')
};
