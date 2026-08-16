const PlanProgreso = require('../../models/PlanProgreso');
const Tienda = require('../../models/Tienda');
const { getInicioDeDiaDeAnteayer } = require('../../utils/fechas');

async function panelAdminPorTienda(tiendasPermitidas = null) {
  const inicioDeDiaDeAnteayer = getInicioDeDiaDeAnteayer();

  const scopeTienda = tiendasPermitidas === null ? {} : { _id: { $in: tiendasPermitidas } };
  const activas = await Tienda.find({ ...scopeTienda, activo: true }).select('_id').lean();
  const activasIds = activas.map(t => t._id);

  if (activasIds.length === 0) {
    return [];
  }

  return PlanProgreso.aggregate([
    { $match: { tienda_id: { $in: activasIds } } },
    {
      $group: {
        _id: '$tienda_id',
        total_activaciones: { $sum: 1 },
        usuarios_activos: { $sum: { $cond: [{ $eq: ['$estado', 'activo'] }, 1, 0] } },
        completados: { $sum: { $cond: [{ $eq: ['$estado', 'completado'] }, 1, 0] } },
        promedio_dia_progreso: { $avg: '$dia_actual' },
        racha_promedio: { $avg: '$racha_dias' },
        // usuarios_en_riesgo: planes activos con 3+ dias sin completar
        // (ultima_fecha_actividad < inicioDelDiaDeAnteayer).
        usuarios_en_riesgo: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$estado', 'activo'] },
                  { $lt: ['$ultima_fecha_actividad', inicioDeDiaDeAnteayer] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    },
    { $lookup: { from: 'tiendas', localField: '_id', foreignField: '_id', as: 'tienda' } },
    { $unwind: { path: '$tienda', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        nombre_tienda: { $ifNull: ['$tienda.nombre_tienda', 'Tienda eliminada'] },
        ciudad: { $ifNull: ['$tienda.ciudad', '—'] }
      }
    },
    {
      $project: {
        _id: 0,
        tienda_id: '$_id',
        nombre_tienda: 1,
        ciudad: 1,
        total_activaciones: 1,
        usuarios_activos: 1,
        completados: 1,
        promedio_dia_progreso: { $round: ['$promedio_dia_progreso', 2] },
        racha_promedio: { $round: ['$racha_promedio', 2] },
        usuarios_en_riesgo: 1
      }
    },
    { $sort: { total_activaciones: -1 } }
  ]);
}

module.exports = { panelAdminPorTienda };
