const test = require('node:test');
const assert = require('node:assert/strict');
const { limparOAB, separarOAB, validarOAB } = require('../utils/validar');

test('normaliza OAB com espaços e pontuação', () => {
  assert.equal(limparOAB('mg-171.934'), 'MG171934');
});

test('separa UF e número da inscrição', () => {
  assert.deepEqual(separarOAB('MG 171934'), { uf: 'MG', numero: '171934' });
});

test('valida inscrição com UF e pelo menos quatro dígitos', () => {
  assert.equal(validarOAB('MG171934'), true);
  assert.equal(validarOAB('SP123'), false);
  assert.equal(validarOAB('171934MG'), false);
});
