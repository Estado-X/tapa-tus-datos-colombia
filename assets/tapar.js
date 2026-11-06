/* Tapar y destapar. Encuentra datos personales colombianos en un texto, los cambia por
   etiquetas numeradas ([CÉDULA_1], [NIT_1]…) y después devuelve los datos reales.
   Todo corre en el navegador: no hay servidor ni se guarda nada. */
(function (raiz) {
  'use strict';

  var TIPOS = {
    correo: 'CORREO', radicado: 'RADICADO', tarjeta: 'TARJETA', cuenta: 'CUENTA', nit: 'NIT',
    cedula: 'CÉDULA', documento: 'DOCUMENTO', telefono: 'TELÉFONO', direccion: 'DIRECCIÓN', placa: 'PLACA',
    nombre: 'NOMBRE', empresa: 'EMPRESA', otro: 'DATO'
  };
  var NOMBRES = {
    correo: 'Correo', radicado: 'Radicado judicial', tarjeta: 'Tarjeta', cuenta: 'Cuenta bancaria', nit: 'NIT',
    cedula: 'Cédula', documento: 'Otro documento', telefono: 'Teléfono', direccion: 'Dirección', placa: 'Placa',
    nombre: 'Nombre', empresa: 'Empresa o entidad', otro: 'Otro dato'
  };
  // Orden de prioridad cuando dos hallazgos se cruzan: gana el primero.
  var ORDEN = ['manual', 'correo', 'radicado', 'cuenta', 'tarjeta', 'nit', 'cedula', 'documento', 'telefono', 'direccion', 'placa'];

  function digitos(s) { return String(s).replace(/\D/g, ''); }
  function sinTildes(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function escapar(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* Dígito de verificación del NIT (módulo 11 con los pesos de la DIAN, de derecha a izquierda). */
  var PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  function dvNit(nit) {
    var d = digitos(nit);
    if (!d || d.length > 15) return null;
    var suma = 0;
    for (var i = 0; i < d.length; i++) suma += +d.charAt(d.length - 1 - i) * PESOS[i];
    var r = suma % 11;
    return r > 1 ? 11 - r : r;
  }

  /* Algoritmo de Luhn, el que usan las tarjetas de crédito y débito. */
  function luhn(numero) {
    var d = digitos(numero);
    if (d.length < 12) return false;
    var suma = 0, doble = false;
    for (var i = d.length - 1; i >= 0; i--) {
      var n = +d.charAt(i);
      if (doble) { n *= 2; if (n > 9) n -= 9; }
      suma += n; doble = !doble;
    }
    return suma % 10 === 0;
  }

  /* --- Detectores. Cada uno devuelve {tipo, inicio, fin, valor, clave, nota}. --- */
  function hallazgo(tipo, inicio, valor, clave, nota) {
    return { tipo: tipo, inicio: inicio, fin: inicio + valor.length, valor: valor, clave: tipo + ':' + clave, nota: nota || '' };
  }
  // Recorre un patrón cuyo último grupo es el dato (el contexto va antes).
  function alFinal(texto, re, fn) {
    var m; re.lastIndex = 0;
    while ((m = re.exec(texto))) {
      var dato = m[m.length - 1];
      if (dato) fn(dato, m.index + m[0].length - dato.length, m);
      if (m[0].length === 0) re.lastIndex++;
    }
  }

  var NO_DIG = '(?<![\\d])';
  var RE = {
    correo: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
    radicado: new RegExp(NO_DIG + '(\\d(?:[ .-]?\\d){22})(?![\\d])', 'g'),
    cuenta: /((?:cuenta|cta\.?)\s+(?:bancaria\s+)?(?:de\s+)?(?:ahorros?|corriente|cte\.?)|n[úu]mero\s+de\s+(?:la\s+)?cuenta|cuenta\s+(?:bancaria\s+)?(?:n[°ºo]\.?|no\.?|n[úu]mero))[^\d\n]{0,45}?(\d[\d -]{4,24}\d)(?![\d])/gi,
    tarjeta: new RegExp(NO_DIG + '([2-6]\\d{3}(?:[ -]?\\d){9,15})(?![\\d])', 'g'),
    nitClave: /(?:^|[^A-Za-z])N\.?\s?I\.?\s?T\.?(?![A-Za-z])[^\d\n]{0,15}?((?:\d{1,3}(?:\.\d{3}){2,3}|\d{6,10})(?:\s?-\s?\d(?![\d.]))?)/gi,
    nitSolo: /(?<![\d.$])((?:\d{1,3}(?:\.\d{3}){1,3}|\d{6,10})\s?-\s?\d)(?![\d])/g,
    cedula: /((?:c[ée]dula(?:\s+de\s+(?:ciudadan[íi]a|extranjer[íi]a))?)|(?<![A-Za-z])C\.?\s?[CEce]\.?(?=[\s:#Nn°ºo.]*\d)|identificad[oa]s?\s+con|documento\s+de\s+identidad)[^\d\n]{0,40}?(\d{1,3}(?:\.\d{3}){1,3}|\d{5,10})(?![\d]|\.\d)/gi,
    documento: /((?:tarjeta\s+de\s+identidad|(?<![A-Za-z])T\.?\s?I\.?(?=[\s:#Nn°ºo.]*\d)|pasaporte|permiso\s+(?:por\s+)?protecci[óo]n\s+temporal|PPT)(?:\s*(?:n[°ºo]\.?|no\.?|n[úu]mero))?[\s:.#]*)([A-Z]{0,3}\d{5,11})(?![\dA-Za-z])/gi,
    celular: /(?<![\d$])((?:\(?\+?57\)?[\s.-]?)?\(?3\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2})(?![\d])/g,
    fijo: /(?<![\d$])((?:\(?\+?57\)?[\s.-]?)?\(?60[1-8]\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2})(?![\d])/g,
    telClave: /((?:tel[ée]fono|tel\.|tel(?=[\s:])|celular|cel\.|m[óo]vil|fijo|pbx|whatsapp))[^\d\n]{0,15}?(\(?\d{1,3}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}|\d{7})(?![\d])/gi,
    placa: /(?<![A-Za-zÁÉÍÓÚÑáéíóúñ0-9])([A-Z]{3}[\s-]?(?:\d{3}|\d{2}[A-Z]))(?![A-Za-z0-9])/g
  };
  var VIA = '(?:avenida\\s+(?:calle|carrera)|av(?:enida)?\\.?\\s*(?:calle|carrera|cra\\.?|cl\\.?|kr\\.?)?|calle|cll?\\.?|carrera|cra\\.?|kra\\.?|kr\\.?|cr\\.?|transversal|trans\\.?|tv\\.?|diagonal|diag\\.?|dg\\.?|circular|autopista|ak\\.?|ac\\.?)';
  var NUM = '\\d{1,3}\\s?[a-z]?(?:\\s?bis)?(?:\\s?[a-z](?![a-z]))?(?:\\s+(?:sur|este|norte|oeste))?';
  RE.direccion = new RegExp('(?<![A-Za-zÁÉÍÓÚÑáéíóúñ])(' + VIA + '\\s*' + NUM + '\\s*(?:#|n[°ºo]\\.?|no\\.?|n[úu]mero)\\s*\\d{1,3}\\s?[a-z]?(?:\\s?bis)?\\s*-\\s*\\d{1,3}(?:\\s+(?:sur|este))?' +
    '(?:\\s*,?\\s*(?:apto\\.?|apartamento|apt\\.?|oficina|of\\.|local|interior|int\\.|torre|casa|piso|bloque)\\s*[a-z0-9-]{1,6})*)', 'gi');

  var NO_PLACAS = /^(ART|LEY|NIT|DEC|RES|ISO|IVA|COP|USD|EUR|CST|CGP|CPC|CPP|CPA|NTC|RUT|SAS|LTD|CIA|PBX|TEL|CEL|APT|PAG|NUM|SMM|UVT|EPS|IPS|ARL|AFP|SIC|DIAN|RNE|CRC|SU|PDF)$/;

  function detectoresAutomaticos(t) {
    var c = [];
    var m;
    RE.correo.lastIndex = 0;
    while ((m = RE.correo.exec(t))) c.push(hallazgo('correo', m.index, m[0], m[0].toLowerCase()));

    alFinal(t, RE.radicado, function (v, i) { if (digitos(v).length === 23) c.push(hallazgo('radicado', i, v, digitos(v))); });
    alFinal(t, RE.cuenta, function (v, i) {
      v = v.replace(/[ -]+$/, '');
      var n = digitos(v).length;
      if (n >= 6 && n <= 20) c.push(hallazgo('cuenta', i, v, digitos(v)));
    });
    alFinal(t, RE.tarjeta, function (v, i) {
      var n = digitos(v).length;
      if (n >= 13 && n <= 19 && luhn(v)) c.push(hallazgo('tarjeta', i, v, digitos(v)));
    });
    alFinal(t, RE.nitClave, function (v, i) {
      var p = v.split('-');
      var base = digitos(p[0]);
      var nota = '';
      if (p.length > 1) nota = dvNit(base) === +digitos(p[1]) ? 'Dígito de verificación correcto' : 'El dígito de verificación no coincide: revísalo';
      else nota = 'Sin dígito de verificación';
      c.push(hallazgo('nit', i, v, base, nota));
    });
    alFinal(t, RE.nitSolo, function (v, i) {
      var p = v.split('-');
      var base = digitos(p[0]);
      if (dvNit(base) === +digitos(p[1])) c.push(hallazgo('nit', i, v, base, 'Dígito de verificación correcto'));
    });
    alFinal(t, RE.cedula, function (v, i) { c.push(hallazgo('cedula', i, v, digitos(v))); });
    alFinal(t, RE.documento, function (v, i) { c.push(hallazgo('documento', i, v, v.toUpperCase())); });
    alFinal(t, RE.celular, function (v, i) { c.push(hallazgo('telefono', i, v, digitos(v).slice(-10))); });
    alFinal(t, RE.fijo, function (v, i) { c.push(hallazgo('telefono', i, v, digitos(v).slice(-10))); });
    alFinal(t, RE.telClave, function (v, i) { c.push(hallazgo('telefono', i, v, digitos(v).slice(-10))); });
    alFinal(t, RE.direccion, function (v, i) {
      v = v.replace(/[\s,]+$/, '');
      c.push(hallazgo('direccion', i, v, sinTildes(v.toLowerCase()).replace(/[^a-z0-9]+/g, ' ').trim()));
    });
    alFinal(t, RE.placa, function (v, i) {
      if (NO_PLACAS.test(v.slice(0, 3))) return;
      c.push(hallazgo('placa', i, v, v.replace(/[\s-]/g, '')));
    });
    return c;
  }

  /* Lo que la persona marca a mano: se busca en todo el texto, sin importar mayúsculas ni tildes. */
  var LETRAS = { a: '[aáàäâ]', e: '[eéèëê]', i: '[iíìïî]', o: '[oóòöô]', u: '[uúùüû]', n: '[nñ]', c: '[cç]' };
  function patronManual(dato) {
    var base = sinTildes(dato.trim().replace(/\s+/g, ' ')).toLowerCase();
    var p = '';
    for (var i = 0; i < base.length; i++) {
      var ch = base.charAt(i);
      if (ch === ' ') p += '\\s+';
      else if (LETRAS[ch]) p += LETRAS[ch];
      else p += escapar(ch);
    }
    return new RegExp('(?<![\\p{L}\\p{N}])' + p + '(?![\\p{L}\\p{N}])', 'giu');
  }
  function claveManual(dato) { return sinTildes(dato.trim().replace(/\s+/g, ' ')).toLowerCase(); }

  function detectoresManuales(t, manuales) {
    var c = [];
    (manuales || []).forEach(function (mn) {
      if (!mn || !mn.texto || !mn.texto.trim()) return;
      var tipo = TIPOS[mn.tipo] ? mn.tipo : 'otro';
      var re = patronManual(mn.texto), m;
      while ((m = re.exec(t))) {
        var h = hallazgo(tipo, m.index, m[0], claveManual(mn.texto), 'Marcado a mano');
        h.manual = true;
        c.push(h);
      }
    });
    return c;
  }

  // El mismo número en otro formato (52.123.456 y 52123456) recibe la misma etiqueta.
  var PROPAGAR = { cedula: 1, nit: 1, cuenta: 1, tarjeta: 1, telefono: 1, radicado: 1 };
  function propagar(t, aceptados) {
    var extra = [], vistos = {};
    aceptados.forEach(function (h) {
      if (!PROPAGAR[h.tipo] || vistos[h.clave]) return;
      vistos[h.clave] = 1;
      var d = h.clave.split(':')[1];
      if (d.length < 6) return;
      var sep = h.tipo === 'cedula' || h.tipo === 'nit' ? '\\.?' : '[\\s.-]?';
      var src = d.split('').join(sep);
      if (h.tipo === 'nit') src += '(?:\\s?-\\s?\\d(?![\\d]))?';
      if (h.tipo === 'telefono') src = '(?:\\(?\\+?57\\)?[\\s.-]?)?' + src;
      var re = new RegExp('(?<![\\d$])' + src + '(?![\\d]|\\.\\d)', 'g'), m;
      while ((m = re.exec(t))) {
        // Un NIT con otro dígito de verificación es otro número (o un error): no se junta.
        var dv = /-\s?(\d)$/.exec(m[0]);
        if (h.tipo === 'nit' && dv && dvNit(d) !== +dv[1]) continue;
        extra.push(hallazgo(h.tipo, m.index, m[0], d, h.nota));
      }
    });
    return extra;
  }

  function cruza(a, lista) {
    for (var i = 0; i < lista.length; i++) if (a.inicio < lista[i].fin && lista[i].inicio < a.fin) return true;
    return false;
  }
  function resolver(candidatos, aceptados) {
    candidatos.slice().sort(function (a, b) {
      var pa = ORDEN.indexOf(a.manual ? 'manual' : a.tipo), pb = ORDEN.indexOf(b.manual ? 'manual' : b.tipo);
      return pa - pb || a.inicio - b.inicio || (b.fin - b.inicio) - (a.fin - a.inicio);
    }).forEach(function (h) { if (!cruza(h, aceptados)) aceptados.push(h); });
    return aceptados;
  }

  /* Todos los hallazgos del texto, sin cruces, en orden de aparición. */
  function detectar(texto, manuales) {
    texto = texto || '';
    var aceptados = resolver(detectoresManuales(texto, manuales).concat(detectoresAutomaticos(texto)), []);
    resolver(propagar(texto, aceptados), aceptados);
    return aceptados.sort(function (a, b) { return a.inicio - b.inicio; });
  }

  /* Cambia los datos por etiquetas. opciones.ignorar: lista de claves que la persona desmarcó. */
  function tapar(texto, opciones) {
    opciones = opciones || {};
    texto = texto || '';
    var ignorar = {};
    (opciones.ignorar || []).forEach(function (k) { ignorar[k] = 1; });
    var hallazgos = detectar(texto, opciones.manuales);
    var porClave = {}, contador = {}, tabla = [], todos = [], salida = '', pos = 0;
    hallazgos.forEach(function (h) {
      var fila = porClave[h.clave];
      if (!fila) {
        fila = { clave: h.clave, tipo: h.tipo, nombreTipo: NOMBRES[h.tipo], valor: h.valor, veces: 0, nota: h.nota, manual: !!h.manual, tapado: !ignorar[h.clave], etiqueta: '' };
        if (fila.tapado) {
          contador[h.tipo] = (contador[h.tipo] || 0) + 1;
          fila.etiqueta = '[' + TIPOS[h.tipo] + '_' + contador[h.tipo] + ']';
          tabla.push(fila);
        }
        porClave[h.clave] = fila;
        todos.push(fila);
      }
      fila.veces++;
      if (!fila.tapado) return;
      salida += texto.slice(pos, h.inicio) + fila.etiqueta;
      pos = h.fin;
    });
    salida += texto.slice(pos);
    return { texto: salida, tabla: tabla, todos: todos, lugares: tabla.reduce(function (s, f) { return s + f.veces; }, 0) };
  }

  /* Devuelve los datos reales en la respuesta de la IA. Acepta [CEDULA_1], [cédula 1] o \[CÉDULA_1\]. */
  function normalEtiqueta(nombre, n) { return sinTildes(nombre).toUpperCase() + '_' + (+n); }
  function destapar(respuesta, tabla) {
    respuesta = respuesta || '';
    var mapa = {};
    (tabla || []).forEach(function (f) {
      var m = /^\[([^\]_]+)_(\d+)\]$/.exec(f.etiqueta);
      if (m) mapa[normalEtiqueta(m[1], m[2])] = f;
    });
    var usadas = {}, desconocidas = [], cambios = 0;
    var reemplazar = function (todo, nombre, n) {
      var k = normalEtiqueta(nombre, n);
      var f = mapa[k];
      if (!f) { if (desconocidas.indexOf(todo) < 0) desconocidas.push(todo); return todo; }
      usadas[f.etiqueta] = 1; cambios++;
      return f.valor;
    };
    var texto = respuesta.replace(/\\?\[\s*([A-Za-zÁÉÍÓÚÑáéíóúñ]+)[\s_-]?(\d+)\s*\\?\]/g, reemplazar);
    // Etiquetas sin corchetes (algunas IA los quitan): solo las que están en la tabla.
    var nombres = {};
    Object.keys(mapa).forEach(function (k) { nombres[k.split('_')[0]] = 1; });
    var lista = Object.keys(nombres);
    if (lista.length) {
      var alt = lista.map(function (n) {
        return n.split('').map(function (ch) { return LETRAS[ch.toLowerCase()] ? LETRAS[ch.toLowerCase()] : escapar(ch); }).join('');
      }).join('|');
      var re = new RegExp('(?<![\\p{L}\\p{N}\\[])(' + alt + ')_(\\d+)(?![\\p{L}\\p{N}\\]])', 'giu');
      texto = texto.replace(re, function (todo, nombre, n) {
        var f = mapa[normalEtiqueta(nombre, n)];
        if (!f) return todo;
        usadas[f.etiqueta] = 1; cambios++;
        return f.valor;
      });
    }
    var faltantes = (tabla || []).filter(function (f) { return !usadas[f.etiqueta]; }).map(function (f) { return f.etiqueta; });
    return { texto: texto, cambios: cambios, desconocidas: desconocidas, faltantes: faltantes };
  }

  var api = { TIPOS: TIPOS, NOMBRES: NOMBRES, dvNit: dvNit, luhn: luhn, claveManual: claveManual, detectar: detectar, tapar: tapar, destapar: destapar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Tapar = api;
})(this);
