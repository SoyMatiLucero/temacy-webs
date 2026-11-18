/*
 * Las entidades del grupo, el nombre de la app y los temas del inicio. Es el único lugar donde se tocan.
 *
 * `guion` y `clave` son el script del chat web de cada entidad, el que da la plataforma para pegar en
 * un sitio (panel › ficha del cliente › Chat web):
 *
 *   <script src="https://app.temacy.ar/widget.js" data-key="wk_…" async></script>
 *
 * `guion` es su `src` y `clave` su `data-key`. La app no lo pega en la página: lo carga dentro del
 * marco de cada chat (charla.js). El chat le habla a la plataforma de donde vino su script, así que
 * no hace falta un servidor en el medio; lo que sí hace falta es que el dominio donde se publique
 * la app esté cargado, en la plataforma, como sitio permitido del chat web de CADA entidad. Sin
 * eso, la plataforma lo rechaza y la app muestra «no está disponible».
 * En una máquina de desarrollo no se usa `guion`: ver comun.js («Dónde está el chat»).
 *
 * El nombre del bot, el color, el logo y los botones de arranque NO van acá: los trae la
 * configuración del chat de cada entidad, así lo que la entidad cambia en la plataforma se ve acá
 * sin tocar este archivo. `color` es sólo el de reserva, para cuando esa configuración no llegó.
 *
 * `consultas` son las preguntas de ejemplo que cada entidad YA publica en su propia página
 * (platform/api/public/suvico.html, mavic.html y ospevic.html), con su tema. La app no contesta
 * nada: las usa para que la persona encuentre su tema sin saber de quién es («préstamo»,
 * «medicamento») y para mandarle la pregunta al chat de la entidad que corresponde. `sit` es en
 * cuál de las `situaciones` del inicio aparece cada una.
 *
 * `reservada: true` es para la entidad cuyas conversaciones pueden tener datos sensibles: en el
 * inicio no se muestra el texto de sus mensajes, sólo que hay uno y cuándo llegó.
 *
 * Ojo: son una copia. Si una entidad cambia las preguntas de su página, hay que cambiarlas acá.
 * Lo ideal a futuro es que cada entidad las cargue como botones de arranque de su chat, que la app
 * ya lee sola.
 */
window.GRUPO = {
  // Provisorio: falta definir la marca del grupo (docs/plan_webapp.md, sección 8).
  nombre: 'Atención al afiliado',

  // Los temas del inicio, dichos como los dice la gente y no por entidad.
  situaciones: [
    { id: 'trabajo', nombre: 'Sueldo y trabajo' },
    { id: 'salud', nombre: 'Salud y remedios' },
    { id: 'familia', nombre: 'Familia' },
    { id: 'beneficios', nombre: 'Cursos y beneficios' },
    { id: 'afiliacion', nombre: 'Afiliación y cuota' }
  ],

  entidades: [
    {
      slug: 'suvico',
      nombre: 'SUVICO',
      que: 'El sindicato',
      temas: 'Sueldo, derechos laborales y servicios del sindicato.',
      guion: 'https://app.temacy.ar/widget.js',
      clave: 'wk_suvico_7b3e2a9c14',
      color: '#DF040B',
      consultas: [
        { sit: 'trabajo', tema: 'Tu sueldo', texto: 'Todavía no cobré mis haberes del mes anterior, ¿qué hago?' },
        { sit: 'trabajo', tema: 'Tu sueldo', texto: 'Creo que me liquidaron mal el sueldo, hay un error en el recibo, ¿qué hago?' },
        { sit: 'trabajo', tema: 'Tu sueldo', texto: '¿Cómo se calcula el aguinaldo de diciembre?' },
        { sit: 'trabajo', tema: 'Tus derechos', texto: 'Hace mucho tiempo no me dan vacaciones, ¿qué debo hacer?' },
        { sit: 'trabajo', tema: 'Tus derechos', texto: 'Estoy trabajando en negro, no me registran, ¿cómo lo denuncio?' },
        { sit: 'trabajo', tema: 'Tus derechos', texto: 'Quiero hacer un reclamo' },
        { sit: 'trabajo', tema: 'El sindicato', texto: 'Quiero dejar mi CV, ¿hay bolsa de trabajo?' },
        { sit: 'afiliacion', tema: 'El sindicato', texto: '¿Cómo me afilio a SUVICO?' },
        { sit: 'familia', tema: 'El sindicato', texto: 'Nació mi bebé, ¿qué necesito para el ajuar?' },
        { sit: 'beneficios', tema: 'El sindicato', texto: 'Quiero consultar por turismo' },
        { sit: 'beneficios', tema: 'El sindicato', texto: '¿Cómo renuevo la tarjeta del colectivo?' },
        { sit: 'beneficios', tema: 'El sindicato', texto: '¿Cuándo abre el Parque del Buen Aire?' }
      ]
    },
    {
      slug: 'mavic',
      nombre: 'Mavic',
      que: 'La mutual',
      temas: 'Cuota, sepelio, subsidios, cursos y beneficios.',
      guion: 'https://app.temacy.ar/widget.js',
      clave: 'wk_af3f6d9ebe7f380d36519ded',
      color: '#30C0D8',
      consultas: [
        { sit: 'afiliacion', tema: 'Cuota y asociación', texto: '¿Qué incluye asociarme a MAVIC?' },
        { sit: 'afiliacion', tema: 'Cuota y asociación', texto: '¿Cuánto sale la cuota mensual de MAVIC?' },
        { sit: 'afiliacion', tema: 'Cuota y asociación', texto: '¿Cómo pago la cuota mensual?' },
        { sit: 'afiliacion', tema: 'Cuota y asociación', texto: 'Quiero darme de baja de MAVIC, ¿cómo lo gestiono?' },
        { sit: 'familia', tema: 'Sepelio', texto: 'Quiero adquirir el servicio de sepelio, ¿cómo lo gestiono?' },
        { sit: 'familia', tema: 'Sepelio', texto: '¿A quiénes cubre el servicio de sepelio?' },
        { sit: 'familia', tema: 'Sepelio', texto: '¿Puedo incluir a mis padres en el servicio de sepelio?' },
        { sit: 'familia', tema: 'Subsidios', texto: '¿Cómo cobro el subsidio por nacimiento?' },
        { sit: 'familia', tema: 'Subsidios', texto: 'Me caso, ¿qué documentación necesito para el subsidio por casamiento?' },
        { sit: 'familia', tema: 'Subsidios', texto: '¿Cuánto tiempo tengo para presentar la documentación del subsidio?' },
        { sit: 'beneficios', tema: 'Capacitación', texto: '¿Cuánto sale el curso de vigilador privado y cuánto dura?' },
        { sit: 'beneficios', tema: 'Capacitación', texto: 'Quiero terminar el secundario, ¿cómo me inscribo?' },
        { sit: 'beneficios', tema: 'Capacitación', texto: '¿Cómo descargo el certificado de un curso que hice?' },
        { sit: 'beneficios', tema: 'Beneficios', texto: '¿Cómo compro en la proveeduría de MAVIC?' },
        { sit: 'beneficios', tema: 'Beneficios', texto: 'Quiero pedir un préstamo, ¿qué requisitos tengo que cumplir?' },
        { sit: 'beneficios', tema: 'Beneficios', texto: '¿Qué descuentos tengo en el gimnasio CAFI?' },
        { sit: 'beneficios', tema: 'Beneficios', texto: '¿Cómo accedo a los beneficios de la farmacia?' }
      ]
    },
    {
      slug: 'ospevic',
      nombre: 'OSPEVIC',
      que: 'La obra social',
      temas: 'Órdenes, medicamentos, urgencias, centro médico y afiliación.',
      guion: 'https://app.temacy.ar/widget.js',
      clave: 'wk_ospevic_7e08f0c3382f2f',
      color: '#10C0D0',
      // Lo que se habla con la obra social puede ser de salud: fuera del chat, la app no muestra
      // lo que dicen sus mensajes (ni deja escrita la consulta que se le mandó).
      reservada: true,
      consultas: [
        { sit: 'salud', tema: 'Órdenes y autorizaciones', texto: '¿Cómo pido una orden de consulta?' },
        { sit: 'salud', tema: 'Órdenes y autorizaciones', texto: '¿Cómo autorizo un estudio médico?' },
        { sit: 'salud', tema: 'Órdenes y autorizaciones', texto: '¿Cuánto tarda la auditoría de un estudio?' },
        { sit: 'salud', tema: 'Farmacia', texto: 'Quiero hacer el trámite de farmacia para autorizar un medicamento con receta' },
        { sit: 'salud', tema: 'Farmacia', texto: 'Quiero saber el estado de mi medicación' },
        { sit: 'salud', tema: 'Farmacia', texto: 'Quiero que me envíen la medicación al interior' },
        { sit: 'salud', tema: 'Farmacia', texto: '¿Dónde retiro mi medicación autorizada?' },
        { sit: 'salud', tema: 'Urgencias', texto: '¿A quién llamo por una urgencia?' },
        { sit: 'salud', tema: 'Urgencias', texto: '¿Las urgencias las atiende la obra social o un servicio aparte?' },
        { sit: 'salud', tema: 'Centro Médico y odontología', texto: '¿Dónde queda el Centro Médico de la obra social?' },
        { sit: 'salud', tema: 'Centro Médico y odontología', texto: '¿Cómo saco un turno en el Centro Médico?' },
        { sit: 'salud', tema: 'Centro Médico y odontología', texto: '¿A dónde consulto por odontología?' },
        { sit: 'salud', tema: 'Centro Médico y odontología', texto: 'Vivo en el interior, ¿a qué número llamo?' },
        { sit: 'salud', tema: 'Discapacidad', texto: '¿A dónde consulto por discapacidad?' },
        { sit: 'salud', tema: 'Discapacidad', texto: '¿Dónde pido las planillas de discapacidad?' },
        { sit: 'afiliacion', tema: 'Afiliación y reclamos', texto: '¿Cómo adhiero a un familiar a la obra social?' },
        { sit: 'afiliacion', tema: 'Afiliación y reclamos', texto: '¿Qué necesito para afiliarme a OSPEVIC?' },
        { sit: 'afiliacion', tema: 'Afiliación y reclamos', texto: '¿Dónde hago un reclamo a la obra social?' },
        { sit: 'afiliacion', tema: 'Afiliación y reclamos', texto: '¿Dónde está mi credencial?' }
      ]
    }
  ]
};
