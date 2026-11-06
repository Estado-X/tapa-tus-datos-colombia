/* Interfaz: tapa el texto mientras escribes, deja revisar la tabla y destapa la respuesta.
   No guarda nada: la tabla vive en la memoria de la página y se borra al cerrarla. */
(function () {
  'use strict';

  var T = window.Tapar;
  var $ = function (s) { return document.querySelector(s); };

  var estado = { ignorar: [], manuales: [], resultado: { texto: '', tabla: [], todos: [], lugares: 0 } };

  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }

  // Muestra el texto tapado con las etiquetas resaltadas, sin usar innerHTML con lo que pegó la persona.
  function pintarConEtiquetas(nodo, texto) {
    nodo.textContent = '';
    var re = /\[[A-ZÁÉÍÓÚÑ]+_\d+\]/g, pos = 0, m;
    while ((m = re.exec(texto))) {
      if (m.index > pos) nodo.appendChild(document.createTextNode(texto.slice(pos, m.index)));
      var mk = document.createElement('mark');
      mk.className = 'etiqueta';
      mk.textContent = m[0];
      nodo.appendChild(mk);
      pos = m.index + m[0].length;
    }
    if (pos < texto.length) nodo.appendChild(document.createTextNode(texto.slice(pos)));
  }

  function pintarTabla() {
    var tb = $('#filas');
    tb.textContent = '';
    var r = estado.resultado;
    r.todos.forEach(function (f) {
      var tr = document.createElement('tr');
      if (!f.tapado) tr.className = 'apagada';
      var td0 = document.createElement('td');
      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = f.tapado;
      cb.setAttribute('aria-label', 'Tapar ' + f.nombreTipo.toLowerCase() + ' ' + f.valor);
      cb.addEventListener('change', function () { alternar(f, cb.checked); });
      td0.appendChild(cb);
      var td1 = document.createElement('td');
      if (f.tapado) { var mk = document.createElement('mark'); mk.className = 'etiqueta'; mk.textContent = f.etiqueta; td1.appendChild(mk); }
      else td1.textContent = 'Sin tapar';
      var td2 = document.createElement('td');
      var v = document.createElement('span'); v.className = 'dato'; v.textContent = f.valor;
      var t = document.createElement('span'); t.className = 'tipo'; t.textContent = f.nombreTipo + (f.nota ? ' · ' + f.nota : '');
      var vm = document.createElement('span'); vm.className = 'veces-movil'; vm.textContent = plural(f.veces, 'vez', 'veces');
      td2.appendChild(v); td2.appendChild(t); td2.appendChild(vm);
      var td3 = document.createElement('td'); td3.textContent = f.veces; td3.className = 'num';
      tr.appendChild(td0); tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
      tb.appendChild(tr);
    });
    $('#vacio').hidden = r.todos.length > 0;
  }

  function alternar(f, tapar) {
    if (f.manual && !tapar) {
      estado.manuales = estado.manuales.filter(function (m) { return f.clave !== m.tipo + ':' + claveDe(m.texto); });
    } else if (tapar) {
      estado.ignorar = estado.ignorar.filter(function (k) { return k !== f.clave; });
    } else if (estado.ignorar.indexOf(f.clave) < 0) {
      estado.ignorar.push(f.clave);
    }
    actualizar();
  }
  function claveDe(t) { return T.claveManual(t); }

  function actualizar() {
    var texto = $('#original').value;
    estado.resultado = T.tapar(texto, { ignorar: estado.ignorar, manuales: estado.manuales });
    var r = estado.resultado;
    pintarConEtiquetas($('#tapado'), r.texto || '');
    pintarTabla();
    $('#resumen').textContent = !texto.trim() ? 'Pega un texto en el paso 1 o carga el ejemplo.' :
      r.tabla.length ? 'Se taparon ' + plural(r.tabla.length, 'dato distinto', 'datos distintos') + ' en ' + plural(r.lugares, 'lugar', 'lugares') + '. Revisa el texto: lo que no se detectó sigue a la vista.' :
      'No se encontró ningún dato con los patrones. Revisa el texto y marca a mano lo que haga falta.';
    destapar();
  }

  function destapar() {
    var resp = $('#respuesta').value;
    var d = T.destapar(resp, estado.resultado.tabla);
    $('#destapado').textContent = d.texto;
    var msg = $('#destapa-msg');
    if (!resp.trim()) { msg.hidden = true; return; }
    var partes = [];
    partes.push(d.cambios ? 'Se devolvieron ' + plural(d.cambios, 'dato', 'datos') + '.' : 'No se encontró ninguna etiqueta de la tabla en la respuesta.');
    if (d.desconocidas.length) partes.push('Estas etiquetas no están en la tabla y quedaron igual: ' + d.desconocidas.join(', ') + '. ¿Recargaste la página o la IA se inventó una?');
    msg.textContent = partes.join(' ');
    msg.className = 'mensaje ' + (d.desconocidas.length || !d.cambios ? 'mensaje--error' : 'mensaje--ok');
    msg.hidden = false;
  }

  function agregarManual(texto) {
    var msg = $('#manual-msg');
    texto = (texto || '').trim();
    if (texto.length < 2) {
      msg.textContent = 'Escribe o selecciona el dato que quieres tapar (al menos 2 letras).';
      msg.className = 'mensaje mensaje--error'; msg.hidden = false; return;
    }
    var tipo = $('#manual-tipo').value;
    var ya = estado.manuales.some(function (m) { return claveDe(m.texto) === claveDe(texto) && m.tipo === tipo; });
    if (!ya) estado.manuales.push({ texto: texto, tipo: tipo });
    $('#manual-texto').value = '';
    actualizar();
    var f = estado.resultado.todos.filter(function (x) { return x.manual && x.clave === tipo + ':' + claveDe(texto); })[0];
    msg.textContent = f ? '«' + texto + '» quedó como ' + f.etiqueta + ' (' + plural(f.veces, 'vez', 'veces') + ').' : '«' + texto + '» no aparece en el texto.';
    msg.className = 'mensaje ' + (f ? 'mensaje--ok' : 'mensaje--error'); msg.hidden = false;
  }

  function copiar(textoCopiar, boton) {
    var hecho = function () {
      var antes = boton.textContent;
      boton.textContent = 'Copiado'; boton.classList.add('ok');
      setTimeout(function () { boton.textContent = antes; boton.classList.remove('ok'); }, 1500);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textoCopiar).then(hecho, function () { viejo(textoCopiar); hecho(); });
    } else { viejo(textoCopiar); hecho(); }
  }
  function viejo(t) {
    var a = document.createElement('textarea');
    a.value = t; a.setAttribute('readonly', ''); a.style.position = 'fixed'; a.style.opacity = '0';
    document.body.appendChild(a); a.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(a);
  }

  function iniciar() {
    $('#original').addEventListener('input', actualizar);
    $('#respuesta').addEventListener('input', destapar);
    $('#ejemplo').addEventListener('click', function () {
      var e = window.EJEMPLO;
      $('#original').value = e.texto;
      estado.ignorar = []; estado.manuales = e.manuales.slice();
      actualizar();
      $('#respuesta').value = e.respuesta;
      destapar();
      $('#manual-msg').hidden = true;
    });
    $('#limpiar').addEventListener('click', function () {
      $('#original').value = ''; $('#respuesta').value = '';
      estado.ignorar = []; estado.manuales = [];
      $('#manual-msg').hidden = true;
      actualizar();
    });
    $('#manual-agregar').addEventListener('click', function () { agregarManual($('#manual-texto').value); });
    $('#manual-texto').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); agregarManual(this.value); } });
    $('#manual-seleccion').addEventListener('click', function () {
      var o = $('#original');
      agregarManual(o.value.slice(o.selectionStart, o.selectionEnd));
    });
    $('#copiar-tapado').addEventListener('click', function (e) { copiar(estado.resultado.texto, e.currentTarget); });
    $('#copiar-destapado').addEventListener('click', function (e) { copiar($('#destapado').textContent, e.currentTarget); });
    window.addEventListener('beforeunload', function (e) {
      if (estado.resultado.tabla.length) { e.preventDefault(); e.returnValue = ''; }
    });
    actualizar();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
