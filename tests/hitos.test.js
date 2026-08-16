const { detectarHito } = require('../src/modules/plan/plan.service');

describe('detectarHito', () => {
  // --- hitos que SÍ existen en HITOS_RACHA = [7, 14, 21, 28] ---

  test('racha_dias = 7 que no está en hitos_alcanzados devuelve 7', () => {
    expect(detectarHito(7, [])).toBe(7);
  });

  test('racha_dias = 14 que no está en hitos_alcanzados devuelve 14', () => {
    expect(detectarHito(14, [7])).toBe(14);
  });

  test('racha_dias = 21 que no está en hitos_alcanzados devuelve 21', () => {
    expect(detectarHito(21, [7, 14])).toBe(21);
  });

  test('racha_dias = 28 que no está en hitos_alcanzados devuelve 28', () => {
    expect(detectarHito(28, [7, 14, 21])).toBe(28);
  });

  // --- deduplicación: hito ya alcanzado devuelve null ---

  test('racha_dias = 7 que ya está en hitos_alcanzados devuelve null', () => {
    expect(detectarHito(7, [7])).toBeNull();
  });

  test('racha_dias = 14 ya alcanzado devuelve null', () => {
    expect(detectarHito(14, [7, 14])).toBeNull();
  });

  test('racha_dias = 21 ya alcanzado devuelve null', () => {
    expect(detectarHito(21, [7, 14, 21])).toBeNull();
  });

  test('racha_dias = 28 ya alcanzado devuelve null', () => {
    expect(detectarHito(28, [7, 14, 21, 28])).toBeNull();
  });

  // --- valores que NO son hito en el array nuevo ---

  test('racha_dias = 3 (no es hito) devuelve null', () => {
    expect(detectarHito(3, [])).toBeNull();
  });

  test('racha_dias = 5 (no es hito) devuelve null', () => {
    expect(detectarHito(5, [])).toBeNull();
  });

  test('racha_dias = 15 (no es hito) devuelve null', () => {
    expect(detectarHito(15, [])).toBeNull();
  });

  test('racha_dias = 30 (no es hito) devuelve null', () => {
    expect(detectarHito(30, [])).toBeNull();
  });

  test('racha_dias = 2 (no es hito) devuelve null', () => {
    expect(detectarHito(2, [])).toBeNull();
  });

  test('hitos_alcanzados vacío, racha_dias = 1 (no es hito) devuelve null', () => {
    expect(detectarHito(1, [])).toBeNull();
  });

  // --- edge cases ---

  test('hitos_alcanzados undefined se trata como array vacío', () => {
    expect(detectarHito(7, undefined)).toBe(7);
  });
});
