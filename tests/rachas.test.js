const { yaCompletoActividadHoy } = require('../src/modules/plan/plan.service');

function crearPlan(progresoDiario, ultimaFecha) {
  return {
    ultima_fecha_actividad: ultimaFecha,
    progreso_diario: progresoDiario
  };
}

function crearDia(diaNumero, completado, fecha) {
  return { dia_numero: diaNumero, completado, fecha_completado: fecha };
}

describe('yaCompletoActividadHoy', () => {
  const hoy = new Date('2025-06-15T12:00:00.000Z');

  test('plan recién creado sin actividad da false', () => {
    const plan = crearPlan(
      [crearDia(1, false, null)],
      hoy
    );
    expect(yaCompletoActividadHoy(plan, hoy)).toBe(false);
  });

  test('plan con actividad completada hoy da true', () => {
    const plan = crearPlan(
      [crearDia(1, true, new Date('2025-06-15T10:00:00.000Z'))],
      new Date('2025-06-15T10:00:00.000Z')
    );
    expect(yaCompletoActividadHoy(plan, hoy)).toBe(true);
  });

  test('plan con actividad de ayer da false', () => {
    const plan = crearPlan(
      [crearDia(1, true, new Date('2025-06-14T10:00:00.000Z'))],
      new Date('2025-06-14T10:00:00.000Z')
    );
    expect(yaCompletoActividadHoy(plan, hoy)).toBe(false);
  });

  test('plan sin ultima_fecha_actividad da false', () => {
    const plan = { ultima_fecha_actividad: null, progreso_diario: [] };
    expect(yaCompletoActividadHoy(plan, hoy)).toBe(false);
  });

  test('actividad completada a las 23:59 de ayer da false', () => {
    const plan = crearPlan(
      [crearDia(1, true, new Date('2025-06-14T23:59:59.999Z'))],
      new Date('2025-06-14T23:59:59.999Z')
    );
    expect(yaCompletoActividadHoy(plan, hoy)).toBe(false);
  });

  test('actividad completada a las 00:00 de hoy da true', () => {
    const plan = crearPlan(
      [crearDia(1, true, new Date('2025-06-15T00:00:00.000Z'))],
      new Date('2025-06-15T00:00:00.000Z')
    );
    expect(yaCompletoActividadHoy(plan, hoy)).toBe(true);
  });
});
