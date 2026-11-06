// Pruebas sin dependencias: node --test pruebas/
const test = require('node:test');
const assert = require('node:assert');
const T = require('../assets/tapar.js');

const tapado = (texto, op) => T.tapar(texto, op).texto;
const tipos = (texto) => T.detectar(texto).map((h) => h.tipo);

test('dígito de verificación del NIT con NIT públicos de entidades', () => {
  assert.strictEqual(T.dvNit('800197268'), 4); // DIAN, 800.197.268-4
  assert.strictEqual(T.dvNit('800.176.089'), 2); // SIC, 800.176.089-2
  assert.strictEqual(T.dvNit('900123456'), 8);
});

test('Luhn: número de prueba de tarjeta y uno que no pasa', () => {
  assert.strictEqual(T.luhn('4111 1111 1111 1111'), true);
  assert.strictEqual(T.luhn('4111 1111 1111 1112'), false);
});

test('NIT con DV correcto se tapa aunque no diga «NIT»', () => {
  assert.strictEqual(tapado('La entidad 800.197.268-4 respondió.'), 'La entidad [NIT_1] respondió.');
});

test('NIT con DV errado: sin la palabra NIT no se tapa; con ella sí, con aviso', () => {
  assert.strictEqual(tapado('Código 800.197.268-5 del lote.'), 'Código 800.197.268-5 del lote.');
  const r = T.tapar('NIT 800197268-5');
  assert.strictEqual(r.texto, 'NIT [NIT_1]');
  assert.match(r.tabla[0].nota, /no coincide/);
});

test('caso de control: un NIT con otro dígito no se junta con el correcto, ni se tapan fecha y monto', () => {
  assert.strictEqual(tapado('La entidad 800.197.268-4 y la 800.197.268-5 firmaron el 15/12/2026 por $3.500.000.'),
    'La entidad [NIT_1] y la 800.197.268-5 firmaron el 15/12/2026 por $3.500.000.');
  assert.strictEqual(tapado('NIT 800.197.268-4, también escrito 800197268.'), 'NIT [NIT_1], también escrito [NIT_1].');
});

test('cédulas con y sin puntos reciben la misma etiqueta', () => {
  const r = T.tapar('Ana, identificada con C.C. No. 52.123.456 de Bogotá. Firma: 52123456.');
  assert.strictEqual(r.texto, 'Ana, identificada con C.C. No. [CÉDULA_1] de Bogotá. Firma: [CÉDULA_1].');
  assert.strictEqual(r.tabla.length, 1);
  assert.strictEqual(r.tabla[0].veces, 2);
});

test('celulares y fijos colombianos, con y sin +57', () => {
  assert.strictEqual(tapado('Llama al 300 123 4567 o al +57 310-555-1234.'), 'Llama al [TELÉFONO_1] o al [TELÉFONO_2].');
  assert.strictEqual(tapado('Fijo: (601) 345 6789 y 6043456789.'), 'Fijo: [TELÉFONO_1] y [TELÉFONO_2].');
  assert.strictEqual(tapado('Tel. 3456789'), 'Tel. [TELÉFONO_1]');
});

test('el mismo celular escrito distinto es el mismo dato', () => {
  const r = T.tapar('Cel 3001234567. Al +57 300 123 4567 escríbeme.');
  assert.strictEqual(r.tabla.length, 1);
  assert.match(r.texto, /\[TELÉFONO_1\]\. Al \[TELÉFONO_1\]/);
});

test('correos y direcciones colombianas', () => {
  assert.strictEqual(tapado('Escribe a ana.gomez@ejemplo.co.'), 'Escribe a [CORREO_1].');
  assert.strictEqual(tapado('Vive en la Calle 45 # 13-20 apto 302, Bogotá.'), 'Vive en la [DIRECCIÓN_1], Bogotá.');
  assert.strictEqual(tapado('Sede: Cra. 8 No. 6C - 38.'), 'Sede: [DIRECCIÓN_1].');
  assert.strictEqual(tapado('Av. Calle 26 # 69D-91 Torre 2'), '[DIRECCIÓN_1]');
  assert.strictEqual(tapado('Diagonal 40A Sur # 22-15'), '[DIRECCIÓN_1]');
});

test('placas de carro y de moto', () => {
  assert.strictEqual(tapado('El vehículo de placas ABC 123 y la moto XYZ12D.'), 'El vehículo de placas [PLACA_1] y la moto [PLACA_2].');
  assert.strictEqual(tapado('Según la LEY 1581 y el ART 123.'), 'Según la LEY 1581 y el ART 123.');
});

test('cuenta bancaria con contexto y tarjeta con Luhn', () => {
  assert.strictEqual(tapado('Consignar en la cuenta de ahorros No. 0123-4567-89 del banco.'), 'Consignar en la cuenta de ahorros No. [CUENTA_1] del banco.');
  assert.strictEqual(tapado('Tarjeta 4111 1111 1111 1111.'), 'Tarjeta [TARJETA_1].');
  assert.strictEqual(tapado('Referencia 4111 1111 1111 1112.'), 'Referencia 4111 1111 1111 1112.');
});

test('radicado judicial de 23 dígitos, con o sin guiones', () => {
  assert.strictEqual(tapado('Proceso 11001-31-03-001-2025-00123-00.'), 'Proceso [RADICADO_1].');
  assert.strictEqual(tapado('Rad. 11001310300120250012300'), 'Rad. [RADICADO_1]');
});

test('casos de control: fechas, montos, normas y plazos no se tapan', () => {
  const t = 'El 15/12/2026 (o 2026-12-15) se pagan $3.500.000, es decir $ 300.000.000,50 en total, el 19 % de IVA, ' +
    'según la Ley 1581 de 2012, el Decreto 1074 de 2015 y la Sentencia C-748 de 2011, dentro de 30 días hábiles. ' +
    'Folio 1.234, artículo 2.2.2.25.2.6, hora 10:30 a. m.';
  assert.strictEqual(tapado(t), t);
});

test('marcar a mano un nombre lo tapa en todo el texto, sin importar tildes ni mayúsculas', () => {
  const r = T.tapar('Ana María Gómez firmó. ANA MARIA GOMEZ es la arrendataria. Habló con Ofertas Andinas.', {
    manuales: [{ texto: 'Ana María Gómez', tipo: 'nombre' }, { texto: 'ofertas andinas', tipo: 'empresa' }]
  });
  assert.strictEqual(r.texto, '[NOMBRE_1] firmó. [NOMBRE_1] es la arrendataria. Habló con [EMPRESA_1].');
});

test('desmarcar un falso positivo lo deja como estaba y renumera', () => {
  const t = 'Placas ABC 123 y DEF 456.';
  const clave = T.detectar(t)[0].clave;
  assert.strictEqual(tapado(t, { ignorar: [clave] }), 'Placas ABC 123 y [PLACA_1].');
});

test('destapar devuelve los datos reales aunque la IA cambie la forma de la etiqueta', () => {
  const r = T.tapar('Ana, C.C. 52.123.456, NIT 800.197.268-4, ana@ejemplo.co.');
  const respuesta = 'La [CÉDULA_1] y el [nit_1]. Escribir a \\[CORREO_1\\]. Copia: CEDULA_1. Ojo con [PLACA_9].';
  const d = T.destapar(respuesta, r.tabla);
  assert.strictEqual(d.texto, 'La 52.123.456 y el 800.197.268-4. Escribir a ana@ejemplo.co. Copia: 52.123.456. Ojo con [PLACA_9].');
  assert.deepStrictEqual(d.desconocidas, ['[PLACA_9]']);
  assert.strictEqual(d.faltantes.length, 0);
});

test('ida y vuelta: tapar y destapar deja el texto igual', () => {
  const t = 'Contrato entre Ana María Gómez, C.C. 52.123.456, celular 300 123 4567, Calle 45 # 13-20, ' +
    'y Ofertas Andinas S.A.S., NIT 900.123.456-8. Proceso 11001-31-03-001-2025-00123-00. Ana María Gómez acepta.';
  const r = T.tapar(t, { manuales: [{ texto: 'Ana María Gómez', tipo: 'nombre' }, { texto: 'Ofertas Andinas S.A.S.', tipo: 'empresa' }] });
  assert.doesNotMatch(r.texto, /52\.123\.456|4567|Gómez|900\.123/);
  assert.strictEqual(T.destapar(r.texto, r.tabla).texto, t);
});

test('el orden de las etiquetas sigue el orden del texto', () => {
  assert.deepStrictEqual(tipos('a@b.co y 300 123 4567 y c@d.co'), ['correo', 'telefono', 'correo']);
  assert.strictEqual(tapado('a@b.co, c@d.co, A@B.CO'), '[CORREO_1], [CORREO_2], [CORREO_1]');
});

test('texto vacío no falla', () => {
  assert.deepStrictEqual(T.tapar('').tabla, []);
  assert.strictEqual(T.destapar('', []).texto, '');
});
