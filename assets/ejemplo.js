/* Texto de ejemplo con datos ficticios. El NIT 999.888.777-1 es inventado (cumple el dígito de verificación). */
(function (raiz) {
  'use strict';
  raiz.EJEMPLO = {
    texto: [
      'CONTRATO DE ARRENDAMIENTO DE VEHÍCULO (ejemplo con datos ficticios)',
      '',
      'Entre Ana María Gómez Rojas, identificada con C.C. No. 52.123.456 de Bogotá, celular 300 123 4567, correo ana.gomez@ejemplo.co, domiciliada en la Calle 45 # 13-20 apto 302, Bogotá, y Ofertas Andinas S.A.S., NIT 999.888.777-1, con sede en la Cra. 7 No. 71-21 oficina 501, teléfono (601) 345 6789, se celebra el presente contrato.',
      '',
      'PRIMERA. Objeto. Ofertas Andinas S.A.S. entrega a Ana María Gómez Rojas el vehículo de placas ABC 123.',
      'SEGUNDA. Precio. $3.500.000 mensuales, consignados en la cuenta de ahorros No. 0123-4567-89 del Banco Ejemplo, desde el 15/12/2026.',
      'TERCERA. Garantía. La arrendataria autoriza el cobro a la tarjeta 4111 1111 1111 1111.',
      'CUARTA. Las partes declaran que existe el proceso 11001-31-03-001-2025-00123-00, que no afecta este contrato. Se aplica la Ley 1581 de 2012.',
      '',
      'Firma: Ana María Gómez Rojas, C.C. 52123456.'
    ].join('\n'),
    manuales: [
      { texto: 'Ana María Gómez Rojas', tipo: 'nombre' },
      { texto: 'Ofertas Andinas S.A.S.', tipo: 'empresa' }
    ],
    respuesta: [
      'Revisé el contrato. Tres puntos:',
      '',
      '1. La cláusula PRIMERA debe identificar mejor el vehículo [PLACA_1]: agrega marca, modelo y número de motor.',
      '2. En la SEGUNDA, la cuenta [CUENTA_1] debe estar a nombre de [EMPRESA_1], NIT [NIT_1], para que el pago quede soportado.',
      '3. La autorización de cobro a la tarjeta [TARJETA_1] necesita el consentimiento expreso de [NOMBRE_1] ([CÉDULA_1]) en un documento aparte.'
    ].join('\n')
  };
})(this);
