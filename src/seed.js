require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Tienda = require('./models/Tienda');
const Usuario = require('./models/Usuario');
const ContenidoDiario = require('./models/ContenidoDiario');
const TestPregunta = require('./models/TestPregunta');
const ContenidoEspecial = require('./models/ContenidoEspecial');
const Producto = require('./models/Producto');
const Codigo = require('./models/Codigo');
const PlanProgreso = require('./models/PlanProgreso');
const HistorialCorreo = require('./models/HistorialCorreo');


// ---------------------------------------------------------------------------
// Mapa de competencias: slug → label legible
// ---------------------------------------------------------------------------
const COMPETENCIA_LABELS = {
  autoconciencia: 'Autoconciencia',
  autoconfianza: 'Autoconfianza',
  autocontrol: 'Autocontrol',
  empatia: 'Empatía',
  motivacion: 'Motivación',
  competencia_social: 'Competencia Social'
};

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ContenidoDiario: 30 días con estructura enriquecida y respuesta_tipo en ejercicio
// ---------------------------------------------------------------------------
const CONTENIDOS = [
{
    dia_numero: 1, tipo_contenido: 'instructivo',
    titulo_modulo: 'Día 1: El Escáner de Energía Vital',
    emociones_objetivo: ['alegría', 'tristeza', 'ira', 'miedo'],
    cabecera: `Bloque 1: Autoconciencia (Días 1-5)\n\nTema: "Reconociendo mis señales internas: El Despertar del Observador".\n\nLa famosa cita de Lao Tzu habla del poder de nuestros pensamientos para moldear nuestras vidas. "Vigila tus pensamientos, se convierten en tus palabras; vigila tus palabras, se convierten en tus acciones; vigila tus acciones, se convierten en tus hábitos; vigila tus hábitos, se convierten en tu carácter; vigila tu carácter, se convierte en tu destino".\n\nLa ciencia confirma que nos convertimos en lo que pensamos. Por término medio, tenemos unos 70.000 pensamientos al día, y los pensamientos que entran en nuestra conciencia están influidos por nuestras experiencias, percepciones y educación.\n\nTener un alto nivel de autoconciencia es crucial para comprender los diversos pensamientos y sistemas de creencias que tenemos sobre nosotros mismos y el mundo. Observar nuestras acciones y hábitos puede proporcionarnos información valiosa sobre lo que pensamos y creemos.`,
    datos_leccion: {
      titulo: 'El Escáner de Energía Vital',
      bloque: 'Autoconciencia',
      concepto: 'La autoconciencia es la capacidad de reconocer un sentimiento o estado físico en el momento en que aparece.',
      ejercicio: {
        nombre: 'Escaneo Corporal Matutino',
        instruccion: 'Al despertar, permanece en la cama durante 2-3 minutos adicionales. Luego, escanea tu cuerpo sistemáticamente de pies a cabeza.',
        pasos: [
          { texto: '¿Cómo están tus niveles de energía hoy? (Escala 1-10)', respuesta_tipo: 'escala', min: 1, max: 10 },
          { texto: '¿Sientes tensión en hombros, cuello o mandíbula?', respuesta_tipo: 'abierta' },
          { texto: '¿Hay ligereza en las piernas o pesadez mental?', respuesta_tipo: 'abierta' },
          { texto: '¿Tu respiración es superficial o profunda?', respuesta_tipo: 'abierta' }
        ],
        tipo: 'reflexion',
        respuesta_tipo: 'abierta'
      },
      contenido: 'La inteligencia emocional consiste en poseer la capacidad de alimentar y gestionar nuestras propias emociones, así como en desarrollar la habilidad de ser observadores atentos y sensibles respecto a las emociones de quienes nos rodean.',
      suplementacion: [
        { nombre: 'Ashwagandha', dosis: '500mg', horario: 'Mañana', beneficio: 'Optimizar la respuesta al estrés cortical' }
      ],
      principio: 'No fuerces tu rutina de ejercicio si tu cuerpo pide recuperación. Aprender a escuchar tu energía es la base para evitar lesiones y el agotamiento crónico.',
      recursos: []
    }
  },
  {
    dia_numero: 2, tipo_contenido: 'cuestionario',
    titulo_modulo: 'Día 2: El Diario de las 3 Señales Vitales',
    emociones_objetivo: ['alegría', 'tristeza', 'ira', 'miedo'],
    datos_leccion: {
      titulo: 'El Diario de las 3 Señales Vitales',
      bloque: 'Autoconciencia',
      concepto: 'Distinguir entre las necesidades fisiológicas y las psicológicas es crítico para la salud global y la toma de decisiones conscientes.',
      ejercicio: {
        nombre: 'Evaluación Pre-Comida/Entrenamiento',
        instruccion: 'Antes de tu comida principal o entrenamiento, califica del 1 al 10:',
        pasos: [
          { texto: 'Hambre Física — Sensaciones reales en el estómago: ____/10', respuesta_tipo: 'escala', min: 1, max: 10 },
          { texto: 'Cansancio Corporal — Fatiga muscular y energética: ____/10', respuesta_tipo: 'escala', min: 1, max: 10 },
          { texto: 'Ansiedad Mental — Tensión psicológica y preocupación: ____/10', respuesta_tipo: 'escala', min: 1, max: 10 }
        ],
        registro: { hambre: '___/10', cansancio: '___/10', ansiedad: '___/10' },
        tipo: 'registro',
        respuesta_tipo: 'escala'
      },
      contenido: 'Aprender a distinguir entre las necesidades fisiológicas y las psicológicas es fundamental para decidir con conciencia qué necesita tu cuerpo en cada momento: alimento, descanso o calma.',
      suplementacion: [
        { nombre: 'L-Teanina', dosis: '200mg', horario: 'Según necesidad', beneficio: 'Calma sin sedación' }
      ],
      principio: 'Aplicación Práctica: si Ansiedad = 8/10 + Energía = 2/10, opta por una caminata suave + L-Teanina (200mg) en lugar de entrenamiento intenso. Si Hambre = 2/10 + Ansiedad = 7/10, considera que el impulso de comer puede ser emocional, no fisiológico. Salud Integral: si tu ansiedad es alta pero tu energía es baja, quizás necesites una caminata suave o estiramientos en lugar de un entrenamiento intenso o una comida por impulso.',
      recursos: []
    }
  },
  {
    dia_numero: 3, tipo_contenido: 'instructivo',
    titulo_modulo: 'Día 3: Nombrar el "Anestésico Emocional"',
    emociones_objetivo: ['alegría', 'tristeza', 'ira', 'miedo'],
    datos_leccion: {
      titulo: 'Nombrar el "Anestésico Emocional"',
      bloque: 'Autoconciencia',
      concepto: 'Frecuentemente usamos la comida hiperpalatable o el sedentarismo como anestésico ante emociones no procesadas como soledad, aburrimiento o frustración.',
      ejercicio: {
        nombre: 'La Pausa del Reconocimiento',
        instruccion: 'Cuando sientas la urgencia de: comer algo procesado sin hambre real; cancelar tu actividad física por "pereza"; procrastinar tareas importantes. Aplica este protocolo de 3 pasos.',
        pasos: [
          { texto: 'DETENTE por 30 segundos', respuesta_tipo: 'accion' },
          { texto: 'NOMBRA en voz alta: "No es hambre/cansancio real, lo que siento es [emoción específica]"', respuesta_tipo: 'accion' },
          { texto: 'ELIGE una acción que realmente sane esa emoción. Poner nombre a la emoción le quita poder al impulso desadaptativo y te permite elegir una acción que realmente sane esa emoción', respuesta_tipo: 'accion' }
        ],
        tipo: 'practica',
        respuesta_tipo: 'abierta'
      },
      contenido: 'Poner nombre a la emoción le quita poder al impulso desadaptativo.',
      suplementacion: [
        { nombre: 'Magnesio Glicinato', dosis: '400mg', horario: '2 horas antes de dormir', beneficio: 'Relajación muscular y regulación del sistema nervioso' }
      ],
      principio: 'Alternativas saludables: llamar a un amigo, respiración consciente, caminata de 5 minutos, una infusión relajante.',
      recursos: []
    }
  },
  {
    dia_numero: 4, tipo_contenido: 'instructivo',
    titulo_modulo: 'Día 4: Movimiento Consciente (Mindfulness Físico)',
    emociones_objetivo: ['alegría', 'tristeza', 'ira', 'miedo'],
    datos_leccion: {
      titulo: 'Movimiento Consciente (Mindfulness Físico)',
      bloque: 'Autoconciencia',
      concepto: 'Integrar la atención plena en todas las áreas de la vida mejora la calidad de vida y la conexión mente-cuerpo.',
      ejercicio: {
        nombre: 'Entrenamiento Sin Distracciones',
        instruccion: 'Durante 10-15 minutos de tu actividad física:',
        pasos: [
          { texto: '1) Elimina distracciones: apaga música, podcasts y notificaciones', respuesta_tipo: 'accion' },
          { texto: '2) Enfoque sensorial: ✓ Concentración en el ritmo de tu respiración\n✓ Contacto consciente de tus pies con el suelo\n✓ Sensación de contracción y relajación muscular\n✓ Percepción del latido cardíaco', respuesta_tipo: 'accion' }
        ],
        tipo: 'practica',
        respuesta_tipo: 'abierta'
      },
      contenido: 'Beneficios Integrados:\n✓ Mejora de la conexión mente-músculo: aumenta la eficacia del ejercicio\n✓ Reducción del estrés: la práctica regular disminuye los niveles de cortisol\n✓ Suplementación pre-entrenamiento: Rhodiola Rosea (500mg) para energía sostenida sin estimulantes artificiales. Cardiosmile para cuidar tu salud cardiovascular.\n\nSalud Integral: Sentir cómo tu corazón late y tus pulmones trabajan refuerza la conexión mente-músculo, mejorando la eficacia del ejercicio y reduciendo el estrés.',
      suplementacion: [
        { nombre: 'Rhodiola Rosea', dosis: '500mg', horario: 'Pre-entrenamiento', beneficio: 'Energía sostenida sin estimulantes artificiales' },
        { nombre: 'Cardiosmile', dosis: '1 sachet', horario: 'Después del almuerzo', beneficio: 'Cuidar tu salud cardiovascular' }
      ],
      principio: 'Salud Integral: sentir cómo tu corazón late y tus pulmones trabajan refuerza la conexión mente-músculo, mejorando la eficacia del ejercicio y reduciendo el estrés.',
      recursos: []
    }
  },
  {
    dia_numero: 5, tipo_contenido: 'cuestionario',
    titulo_modulo: 'Día 5: El Mapa de Ritmos Biológicos Personales',
    emociones_objetivo: ['alegría', 'tristeza', 'ira', 'miedo'],
    conclusion: 'Conclusión: El Despertar Continuo.\n\nLa autoconciencia integral no es un destino, sino un viaje continuo de descubrimiento personal. Este programa de 5 días establece las bases para una relación más consciente y saludable contigo mismo, integrando la sabiduría ancestral del mindfulness con la inteligencia emocional.\n\nReflexión Final: "Cuando respiras conscientemente, ya has llegado a casa" - Thich Nhat Hanh. La práctica diaria de estos principios te permitirá vivir con mayor calma, energía y bienestar auténtico.\n\nLa combinación de técnicas de autoconciencia con suplementación natural estratégica crea un enfoque holístico que honra tanto la complejidad de tu ser como la simplicidad de estar presente en cada momento.',
    datos_leccion: {
      titulo: 'El Mapa de Ritmos Biológicos Personales',
      bloque: 'Autoconciencia',
      concepto: 'Comprender los patrones y disparadores que conducen a hábitos poco saludables permite una planificación estratégica del bienestar.',
      ejercicio: {
        nombre: 'Análisis de Patrones',
        instruccion: 'Revisa tus anotaciones de los días 1-4 y responde las siguientes preguntas de autoconocimiento.',
        pasos: [
          { texto: '¿A qué hora del día te sientes más fuerte para ejercitarte?', respuesta_tipo: 'abierta' },
          { texto: '¿En qué momento tu mente pide más "consuelo" a través de la comida?', respuesta_tipo: 'abierta' },
          { texto: '¿Qué emociones específicas identificaste como "anestésicos"?', respuesta_tipo: 'abierta' },
          { texto: '¿Cuáles fueron tus niveles de energía más consistentes?', respuesta_tipo: 'abierta' }
        ],
        tipo: 'reflexion',
        respuesta_tipo: 'abierta'
      },
contenido: 'Beneficios del Enfoque Integral — Enfoque 360°: esta semana abordamos la salud desde tres pilares fundamentales. Mente: técnicas de mindfulness y autoconciencia. Movimiento: ejercicio consciente y conexión corporal. Nutrición: suplementación natural y timing estratégico. Prevención Inteligente: enseña a no sobreentrenar cuando el cuerpo necesita recuperación; previene la alimentación emocional mediante reconocimiento consciente; genera resultados más sostenibles y reduce la frustración. Optimización Personalizada: planificación de suplementación según tus ritmos (ej: Ashwagandha en momentos de mayor estrés); timing nutricional — programa comidas cuando tu cuerpo más lo necesita; rutina de ejercicio — establece horarios basados en tus picos de energía natural.',
      suplementacion: [
        { nombre: 'Ashwagandha', dosis: '500mg', horario: 'Mañana', beneficio: 'Reducción de cortisol y estrés' },
        { nombre: 'Magnesio Glicinato', dosis: '400mg', horario: '2 horas antes de dormir', beneficio: 'Relajación muscular y sueño' },
        { nombre: 'L-Teanina', dosis: '200mg', horario: 'Según necesidad', beneficio: 'Calma sin sedación' },
        { nombre: 'Rhodiola Rosea', dosis: '500mg', horario: 'Pre-entrenamiento', beneficio: 'Energía adaptógena' }
      ],
      principio: 'Protocolos Específicos por Situación — Para Energía Sostenida: Rhodiola Rosea + Complejo B + Magnesio; Para Manejo de Estrés: Ashwagandha + L-Teanina + Respiración consciente; Para Calidad de Sueño: Magnesio Glicinato + Rutina de escaneo corporal nocturno. Implementación y Seguimiento — Lista de Verificación Diaria: escaneo corporal matutino (2-3 minutos); evaluación de las 3 señales antes de comidas principales; práctica de nombrar el "anestésico" cuando sea necesario; movimiento consciente (mínimo 10 minutos); registro de patrones y observaciones. Indicadores de Progreso: mayor claridad en la identificación de necesidades reales vs. impulsos; reducción de episodios de alimentación emocional; mejora en la calidad del sueño y recuperación; aumento de la energía sostenida durante el día; mayor conexión y satisfacción con la rutina de ejercicio.',
      recursos: []
    }
  },
  {
    dia_numero: 6, tipo_contenido: 'instructivo',
    titulo_modulo: 'Día 6: El Cambio de Narrativa Sistémica',
    emociones_objetivo: ['alegría', 'tristeza'],
    cabecera: `Bloque 2: Autoconfianza (Días 6-10)\n\nTema Central: "Creer en mi propia capacidad de cambio: De la Víctima al Protagonista"\n\nMuchos de nosotros llegamos a este punto con una mochila cargada de lo que llamamos "fracasos" dietéticos o rutinas de ejercicio abandonadas. Esa historia ha erosionado nuestra confianza, haciéndonos creer que no tenemos "fuerza de voluntad".\n\nSin embargo, la autoconfianza en la salud integral no es una cualidad mágica con la que se nace; es una competencia que se construye. En estos próximos 5 días, vamos a dejar atrás la identidad del "dietante fallido o el perezoso" para convertirnos en los autores de nuestra propia historia.\n\nConstruir autoconfianza y autoeficacia significa entender que eres capaz de nutrir tu cuerpo y moverte con decisiones inteligentes, celebrando cada pequeña victoria como una prueba real de tu poder de transformación. Tu mente cree lo que le dices: hoy empezamos a decirle que sí puedes.`,
    datos_leccion: {
      titulo: 'El Cambio de Narrativa Sistémica',
      bloque: 'Autoconfianza',
      concepto: 'La autoeficacia surge al silenciar al "saboteador interno" que recuerda fracasos tanto en la dieta como en el gimnasio. La neuroplasticidad permite que el cerebro se reorganice y adopte nuevas identidades.',
      ejercicio: {
        nombre: 'Reescritura de Identidad',
        instruccion: 'Protocolo de Transformación Narrativa:',
        pasos: [
          { texto: '1) Identificación: escribe una etiqueta limitante específica que te define. Ejemplos: "Soy perezoso para el ejercicio", "No tengo voluntad con el dulce", "Siempre abandono las dietas"', respuesta_tipo: 'abierta' },
          { texto: '2) Ritual de liberación: táchala físicamente con una línea roja gruesa', respuesta_tipo: 'accion' },
          { texto: '3) Creación de nueva identidad: redacta tu nueva narrativa en presente. ✅ "Soy una persona que elige cuidar su energía y su salud cada día" · ✅ "Soy alguien que toma decisiones conscientes sobre su bienestar" · ✅ "Soy una persona comprometida con su transformación integral"', respuesta_tipo: 'abierta' }
        ],
        tipo: 'reflexion',
        respuesta_tipo: 'abierta'
      },
      contenido: 'La autoconfianza no es una cualidad mágica con la que se nace; es una competencia que se construye.',
      suplementacion: [
        { nombre: 'Complejo B', dosis: '1 cápsula', horario: 'Mañana', beneficio: 'Optimizar función cerebral y síntesis de neurotransmisores' },
        { nombre: 'L-Teanina', dosis: '200mg', horario: 'Según necesidad', beneficio: 'Calma sin sedación' }
      ],
      principio: 'Beneficio integral: cambiar tu diálogo interno reduce el cortisol, facilitando que tu cuerpo responda mejor al entrenamiento y a la nutrición.',
      recursos: []
    }
  },
  {
    dia_numero: 7, tipo_contenido: 'cuestionario',
    titulo_modulo: 'Día 7: El Contrato de Micro-Compromiso 360°',
    emociones_objetivo: ['alegría', 'tristeza'],
    datos_leccion: {
      titulo: 'El Contrato de Micro-Compromiso 360°',
      bloque: 'Autoconfianza',
      concepto: 'La confianza se construye cumpliendo promesas pequeñas y realistas. Los microhábitos generan cambios neurológicos que fortalecen la voluntad.',
      ejercicio: {
        nombre: 'Micro-Contrato Diario',
        instruccion: 'CONTRATO CONMIGO MISMO/A:\n\nCompleta cada campo para firmar tu contrato personal.',
        pasos: [
          { texto: '1) Fecha:', respuesta_tipo: 'abierta' },
          { texto: '2) Compromiso del día: escribe EL MICRO-COMPROMISO QUE ELIJES (solo UNO). Opciones: · Tomar mi dosis de suplemento todos los días · Hacer 5 minutos de estiramientos al despertar · Leer una página al día de un libro de autoayuda o crecimiento personal · Caminar 10 minutos después del almuerzo', respuesta_tipo: 'abierta' },
          { texto: '3) Hora específica en la que lo vas a cumplir:', respuesta_tipo: 'abierta' },
          { texto: '4) Testigo (opcional):', respuesta_tipo: 'abierta' },
          { texto: '5) Firma:', respuesta_tipo: 'abierta' }
        ],
        tipo: 'registro',
        respuesta_tipo: 'estructurado'
      },
      contenido: 'Cumplir este pequeño hito le demuestra a tu cerebro que eres capaz de mantener la disciplina.',
      suplementacion: [
        { nombre: 'Aminoácidos', dosis: 'Según indicación', horario: 'Pre o post-entrenamiento', beneficio: 'Acelerar la recuperación y fortalecer la sensación de logro físico' }
      ],
      principio: 'Cumplir este pequeño hito le demuestra a tu cerebro que eres capaz de mantener la disciplina, fortaleciendo tu voluntad para retos mayores.',
      recursos: []
    }
  },
  {
    dia_numero: 8, tipo_contenido: 'cuestionario',
    titulo_modulo: 'Día 8: Victorias de Calidad de Vida (Método No-Balanza)',
    emociones_objetivo: ['alegría', 'tristeza'],
    datos_leccion: {
      titulo: 'Victorias de Calidad de Vida (Método No-Balanza)',
      bloque: 'Autoconfianza',
      concepto: 'La obsesión con el peso suele erosionar la confianza; buscamos éxitos en el bienestar global que refuercen la autoeficacia.',
      ejercicio: {
        nombre: 'Auditoría de Bienestar Integral',
        instruccion: 'Hoy ignora completamente la balanza. En su lugar, evalúa cada área y registra tu observación:',
        pasos: [
          { texto: 'Energía Física — ¿Subiste escaleras con menos fatiga?', respuesta_tipo: 'abierta' },
          { texto: 'Claridad Mental — ¿Te sientes más enfocado/a durante el trabajo?', respuesta_tipo: 'abierta' },
          { texto: 'Fuerza Muscular — ¿Tus músculos se sienten más firmes al tacto?', respuesta_tipo: 'abierta' },
          { texto: 'Calidad de Sueño — ¿Despertaste más descansado/a?', respuesta_tipo: 'abierta' },
          { texto: 'Estado de Ánimo — ¿Te sientes más optimista que la semana pasada?', respuesta_tipo: 'abierta' }
        ],
        tipo: 'registro',
        respuesta_tipo: 'abierta',
        registro: {
          energia_fisica: { pregunta: '¿Subiste escaleras con menos fatiga?', observacion: '' },
          claridad_mental: { pregunta: '¿Te sientes más enfocado/a durante el trabajo?', observacion: '' },
          fuerza_muscular: { pregunta: '¿Tus músculos se sienten más firmes?', observacion: '' },
          calidad_sueno: { pregunta: '¿Despertaste más descansado/a?', observacion: '' },
          estado_animo: { pregunta: '¿Te sientes más optimista que la semana pasada?', observacion: '' }
        },
      },
      contenido: 'Reconocer que tu corazón late con más fuerza y tu cuerpo se siente más ágil es el verdadero indicador de una salud funcional.',
      suplementacion: [
        { nombre: 'Omega-3 (EPA/DHA)', dosis: '1000mg', horario: 'Con comida principal', beneficio: 'Soporte neurológico y estabilidad emocional' }
      ],
      principio: 'Celebración consciente: reconocer tu bienestar global es el verdadero indicador de salud funcional.',
      recursos: []
    }
  },
  {
    dia_numero: 9, tipo_contenido: 'instructivo',
    titulo_modulo: 'Día 9: El Poder del "Yo Elijo mi Bienestar"',
    emociones_objetivo: ['alegría', 'tristeza'],
    datos_leccion: {
      titulo: 'El Poder del "Yo Elijo mi Bienestar"',
      bloque: 'Autoconfianza',
      concepto: 'La proactividad es la responsabilidad de hacer que las cosas sucedan por convicción, no por obligación. El lenguaje interno determina la adherencia a largo plazo.',
      ejercicio: {
        nombre: 'Declaración de Elección Consciente',
        instruccion: 'Protocolo de Transformación Lingüística:\n\nAntes de realizar CUALQUIER acción de salud, di en voz alta la Fórmula de Empoderamiento: "Yo elijo [acción específica] porque valoro mi [beneficio personal]".\n\nEjemplos prácticos: ❌ "Tengo que tomar mis suplementos" → ✅ "Yo elijo tomar mi Ashwagandha porque valoro mi tranquilidad mental" · ❌ "Debo ir al gimnasio" → ✅ "Yo elijo moverme porque valoro mi vitalidad y energía" · ❌ "No puedo comer esto" → ✅ "Yo elijo alimentos que nutren mi cuerpo porque valoro mi bienestar"',
        pasos: [
          { texto: 'En lugar de "Tengo que tomar mis suplementos" → "Yo elijo tomar mi Ashwagandha porque valoro mi tranquilidad mental"', respuesta_tipo: 'accion' },
          { texto: 'En lugar de "Debo ir al gimnasio" → "Yo elijo moverme porque valoro mi vitalidad y energía"', respuesta_tipo: 'accion' },
          { texto: 'En lugar de "No puedo comer esto" → "Yo elijo alimentos que nutren mi cuerpo porque valoro mi bienestar"', respuesta_tipo: 'accion' }
        ],
        tipo: 'practica',
        registro: { formula: '"Yo elijo [acción] porque valoro mi [beneficio personal]"' },
        respuesta_tipo: 'abierta'
      },
      contenido: 'Eliminar el "tengo que" y convertirlo en "elijo" elimina la resistencia mental y mejora la adherencia a largo plazo.',
      suplementacion: [
        { nombre: 'Ashwagandha + Complejo B + Omega-3', dosis: '', horario: '', beneficio: 'Stack completo: optimización mental y emocional integral' }
      ],
      principio: 'Transformación mental: eliminar el "tengo que hacer ejercicio" y convertirlo en "elijo moverme" elimina la resistencia mental y mejora la adherencia a largo plazo.',
      recursos: []
    }
  },
  {
    dia_numero: 10, tipo_contenido: 'cuestionario',
    titulo_modulo: 'Día 10: Auditoría de la Nueva Identidad',
    emociones_objetivo: ['alegría', 'tristeza'],
    conclusion: 'Conclusión: El Arquitecto de tu Nueva Historia.\n\nEn cinco días has dejado atrás la identidad del "dietante fallido" para convertirte en el autor de tu propia narrativa. Cada pequeña victoria que reconociste no fue casualidad: fue la prueba concreta de que tu mente cree lo que le dices.\n\nReflexión Final: "No eres el fracaso del pasado, eres el constructor del presente." La autoconfianza no se hereda: se construye con decisiones inteligentes y celebradas a diario.\n\nTu cerebro ya está formando los caminos que sostienen esta nueva identidad. Nutre tu cuerpo, muévete con intención y repítete a diario que sí puedes.',
    datos_leccion: {
      titulo: 'Auditoría de la Nueva Identidad',
      bloque: 'Autoconfianza',
      concepto: 'Visualizar el progreso acumulado en todas las áreas refuerza la creencia en la propia capacidad de cambio y consolida la nueva identidad.',
      ejercicio: {
        nombre: 'Revisión de Transformación',
        instruccion: 'Análisis de los Últimos 4 Días:\n\nHaz una lista de 3 momentos específicos donde actuaste como el "protagonista" de tu salud integral.',
        pasos: [
          { texto: '1) Momento de Protagonismo #1: ·Situación: ___ ·Acción tomada: ___ ·Cómo me sentí: ___', respuesta_tipo: 'abierta' },
          { texto: '2) Momento de Protagonismo #2: ·Situación: ___ ·Acción tomada: ___ ·Cómo me sentí: ___', respuesta_tipo: 'abierta' },
          { texto: '3) Momento de Protagonismo #3: ·Situación: ___ ·Acción tomada: ___ ·Cómo me sentí: ___', respuesta_tipo: 'abierta' }
        ],
        tipo: 'reflexion',
        respuesta_tipo: 'abierta'
      },
      contenido: 'Reflexión Final: ¿Todavía crees que no puedes? Los hechos demuestran que ya estás transformando tu mente y tu cuerpo.\n\nConsolidación Nutricional:\n• Evaluación: qué suplementos han generado mayor impacto\n• Planificación futura: diseño de tu stack personalizado basado en resultados observados\n\nProtocolo de Suplementación Avanzado (Días 6-10) — Stack de Autoconfianza y Rendimiento:\nDía 6 · Complejo B + Ashwagandha · 1 cápsula c/u · Mañana · Optimización neurológica\nDía 7 · Aminoácidos · Según indicación · Pre o post-entrenamiento · Refuerzo de logros físicos\nDía 8 · Omega-3 (EPA/DHA) · 1000mg · Con comida principal · Estabilidad emocional',
      suplementacion: [
        { nombre: 'Complejo B + Ashwagandha', dosis: '1 cápsula c/u', horario: 'Mañana', beneficio: 'Optimización neurológica' },
        { nombre: 'Aminoácidos', dosis: 'Según indicación', horario: 'Pre o post-entrenamiento', beneficio: 'Refuerzo de logros físicos' },
        { nombre: 'Omega-3 (EPA/DHA)', dosis: '1000mg', horario: 'Con comida principal', beneficio: 'Estabilidad emocional' }
      ],
      principio: 'Beneficios del Enfoque Multiproducto:\n• Fidelización estratégica: al abordar energía, descanso y claridad mental, se justifica naturalmente la necesidad de múltiples productos; cada suplemento tiene un propósito específico en el desarrollo de la autoconfianza.\n• Reducción de frustración: al enfocarse en "victorias no-balanza", mantienes motivación independientemente de las fluctuaciones de peso, garantizando continuidad y compras recurrentes.\n• Desarrollo de autoeficacia: cada micro-compromiso cumplido fortalece la creencia en tu capacidad personal de cambio; la suplementación estratégica apoya los procesos neurológicos del cambio de hábitos.',
      recursos: []
    }
  },
  {
    dia_numero: 11, tipo_contenido: 'instructivo',
    titulo_modulo: 'Día 11: La Regla de los 5 Minutos (Mente y Cuerpo)',
    emociones_objetivo: ['ira', 'miedo'],
    cabecera: `Bloque 3: Autocontrol y Gestión Integral (Días 11-15)\n\nTema Central: "La Pausa Poderosa: Gestión vs. Represión"\n\nTransformación Clave: Este bloque transforma la teoría en disciplina consciente. El autocontrol no se limita a la comida, sino que abarca la gestión integral del estrés, sedentarismo y calidad del sueño, factores que impactan directamente en la salud cardiovascular y metabólica.\n\nA menudo confundimos el autocontrol con una "represión espartana" o una lucha agotadora contra nuestros deseos. Sin embargo, la verdadera Inteligencia Emocional nos enseña que el control nace de la capacidad de gestionar los impulsos y las emociones conflictivas, no de negarlas.\n\nEn este bloque, aprenderemos que el autocontrol es, en realidad, la habilidad de crear un espacio consciente entre el estímulo (un antojo, el estrés o la pereza) y nuestra respuesta. No se trata de prohibir, sino de elegir con libertad.\n\nAl integrar esta "Pausa Poderosa" en tu nutrición, en tu movimiento y en tu descanso, dejas de ser un pasajero de tus impulsos para convertirte en el conductor de tu bienestar. Recuerda: tú controlas lo que haces; tus impulsos momentáneos no definen tu salud integral.`,
    datos_leccion: {
      titulo: 'La Regla de los 5 Minutos (Mente y Cuerpo)',
      bloque: 'Autocontrol',
      concepto: 'Crear un espacio consciente entre el estímulo y la respuesta para evitar reacciones automáticas. La corteza prefrontal necesita tiempo para evaluar opciones y ejercer control inhibitorio.',
      ejercicio: {
        nombre: 'Protocolo de Pausa Consciente',
        instruccion: 'Situaciones de Activación: · Antojo de comida procesada sin hambre real · Urgencia de quedarse sedentario frente a pantallas · Impulso de procrastinar actividades de bienestar.\n\nProtocolo de 5 Minutos:',
        pasos: [
          { texto: '1) DETECCIÓN: Reconoce el impulso automático', respuesta_tipo: 'accion' },
          { texto: '2) CRONÓMETRO: Activa timer de 5 minutos exactos', respuesta_tipo: 'accion' },
          { texto: '3) ACTIVIDAD OPUESTA: Ejecuta la acción contraria al impulso. · Si es antojo alimentario → bebe 500ml de agua lentamente o una infusión · Si es sedentarismo → realiza 10 estiramientos suaves · Si es procrastinación → camina 5 minutos al aire libre', respuesta_tipo: 'accion' },
          { texto: '4) EVALUACIÓN POST-PAUSA: Si el deseo persiste → actúa con conciencia plena, no automáticamente. Si desaparece → era una señal de estrés/aburrimiento, no necesidad real', respuesta_tipo: 'accion' }
        ],
        tipo: 'practica',
        respuesta_tipo: 'abierta'
      },
      contenido: 'El autocontrol no es represión espartana; es la habilidad de crear un espacio consciente entre el estímulo y nuestra respuesta.',
      suplementacion: [
        { nombre: 'L-Teanina', dosis: '200mg', horario: 'Según necesidad', beneficio: 'Mantener calma durante la pausa sin sedación' }
      ],
      principio: 'Beneficio integral: fortalece la conexión entre corteza prefrontal y autocontrol.',
      recursos: []
    }
  },
  {
    dia_numero: 12, tipo_contenido: 'instructivo',
    titulo_modulo: 'Día 12: El Ritual de la Disciplina Circadiana',
    emociones_objetivo: ['ira', 'miedo'],
    datos_leccion: {
      titulo: 'El Ritual de la Disciplina Circadiana',
      bloque: 'Autocontrol',
      concepto: 'El autocontrol se fortalece mediante rutinas que estabilizan los ritmos biológicos. El cortisol sigue un patrón circadiano que puede optimizarse.',
      ejercicio: {
        nombre: 'Hora Sagrada de Regulación',
        instruccion: 'Protocolo de "Hora Sagrada":\n\n1) Preparación: elige una hora fija (ej: 7:00 AM o 6:00 PM)\n2) Ritual de suplementación: Ashwagandha + Complejo B (mañana) o Magnesio + Melatonina (noche)\n3) Caminata de 10 minutos: sin distracciones, enfoque en respiración\n4) Hidratación consciente: 200ml de agua, bebida lentamente.\n\nEstablecimiento de Anclajes Circadianos: · Misma hora diaria → Suplementación estratégica (2 min) → Regulación cortisol · +10 minutos → Caminata consciente (10 min) → Activación metabólica · +5 minutos → Hidratación mindful (3 min) → Optimización celular',
        pasos: [
          { texto: '1) Preparación: elige una hora fija (ej: 7:00 AM o 6:00 PM)', respuesta_tipo: 'accion' },
          { texto: '2) Ritual de suplementación: Ashwagandha + Complejo B (mañana) o Magnesio + Melatonina (noche)', respuesta_tipo: 'accion' },
          { texto: '3) Caminata de 10 minutos: sin distracciones, enfoque en respiración', respuesta_tipo: 'accion' },
          { texto: '4) Hidratación consciente: 200ml de agua, bebida lentamente', respuesta_tipo: 'accion' }
        ],
        tipo: 'practica',
        registro: { horario_elegido: '', suplemento_matutino: '', suplemento_nocturno: '' },
        respuesta_tipo: 'estructurado'
      },
      contenido: 'Cumplir este horario entrena al cerebro en autoeficacia y regula el cortisol, la hormona del estrés que dispara la ingesta emocional.',
      suplementacion: [
        { nombre: 'Ashwagandha + Complejo B', dosis: '300mg + 1 cápsula', horario: 'Mañana', beneficio: 'Regulación de cortisol' },
        { nombre: 'Magnesio Glicinato + Melatonina', dosis: '400mg + 1-2mg', horario: 'Noche', beneficio: 'Recuperación y sueño reparador' }
      ],
      principio: 'Principio Clave: cumplir este horario entrena al cerebro en autoeficacia y ayuda a regular el cortisol, la hormona del estrés que dispara la ingesta emocional.',
      recursos: []
    }
  },
  {
    dia_numero: 13, tipo_contenido: 'cuestionario',
    titulo_modulo: 'Día 13: Higiene del Entorno de Bienestar',
    emociones_objetivo: ['ira', 'miedo'],
    datos_leccion: {
      titulo: 'Higiene del Entorno de Bienestar',
      bloque: 'Autocontrol',
      concepto: 'La gestión del impulso es más efectiva cuando diseñamos un ambiente que no nos sabotea. El diseño ambiental moldea comportamientos automáticos.',
      ejercicio: {
        nombre: 'Rediseño Estratégico del Ambiente',
        instruccion: 'Auditoría de Disparadores Ambientales:\n\nEjemplos Prácticos de Transformación: · Control remoto en sofá → Cajón del mueble → Mat de yoga visible · Snacks procesados → Despensa alta → Frutas a la vista · Celular en mesa de noche → Cargador en sala → Libro de mindfulness',
        pasos: [
          { texto: 'Paso 1 · Identificación de Saboteadores — objeto/alimento problemático ___ · ubicación actual ___ · frecuencia de uso impulsivo ___ veces/día', respuesta_tipo: 'abierta' },
          { texto: 'Paso 2 · Reubicación Estratégica — nueva ubicación (menos accesible) ___ · tiempo adicional requerido para acceso ___ minutos', respuesta_tipo: 'abierta' },
          { texto: 'Paso 3 · Sustitución Positiva — objeto/elemento saludable en su lugar ___ · acción que promueve ___', respuesta_tipo: 'abierta' }
        ],
        tipo: 'registro',
        respuesta_tipo: 'abierta',
        registro: {
          saboteador: { objeto: '', ubicacion_actual: '', frecuencia: '' },
          reubicacion: { nueva_ubicacion: '', tiempo_extra_acceso: '' },
          sustituto: { objeto_saludable: '', accion_que_promueve: '' }
        },
      },
      contenido: 'Optimización del Espacio de Suplementación:\n• Crea una "estación de bienestar": lugar visible con suplementos organizados\n• Recordatorios visuales: notas adhesivas con horarios de toma\n• Agua siempre disponible: botella llena junto a los suplementos',
      suplementacion: [],
      principio: 'Principio Inteligente: controlar tu entorno es la forma más eficiente de no agotar tu fuerza de voluntad.',
      recursos: []
    }
  },
  {
    dia_numero: 14, tipo_contenido: 'instructivo',
    titulo_modulo: 'Día 14: La Pausa Respiratoria Pre-Acción',
    emociones_objetivo: ['ira', 'miedo'],
    datos_leccion: {
      titulo: 'La Pausa Respiratoria Pre-Acción',
      bloque: 'Autocontrol',
      concepto: 'Utilizar la fisiología para calmar el sistema nervioso antes de tomar decisiones de salud. La respiración consciente activa el sistema parasimpático.',
      ejercicio: {
        nombre: 'Protocolo de Respiración Estratégica 4-6-8',
        instruccion: 'Técnica de Respiración 4-6-8:\n\n1) Inhalación nasal: 4 segundos (expande abdomen)\n2) Retención: 6 segundos (sin tensión)\n3) Exhalación bucal: 8 segundos (activación parasimpática).\n\nMomentos de Aplicación Obligatoria:\n• Pre-Comida Principal: 3 ciclos antes de comer · enfoque "Yo controlo mis decisiones alimentarias" · mejora la digestión y reduce la ingesta emocional\n• Pre-Entrenamiento: 3 ciclos antes de ejercitarse · enfoque "Mi cuerpo está preparado para el movimiento" · optimiza rendimiento y conexión mente-músculo\n• Pre-Suplementación: 1 ciclo antes de tomar suplementos · enfoque "Elijo nutrir mi cuerpo conscientemente" · refuerza intención y adherencia',
        pasos: [
          { texto: '1) Inhalación nasal: 4 segundos (expande abdomen)', respuesta_tipo: 'accion' },
          { texto: '2) Retención: 6 segundos (sin tensión)', respuesta_tipo: 'accion' },
          { texto: '3) Exhalación bucal: 8 segundos (activación parasimpática)', respuesta_tipo: 'accion' }
        ],
        tipo: 'practica',
        registro: {
          pre_comida: { ciclos: 3, enfoque: '"Yo controlo mis decisiones alimentarias"' },
          pre_entrenamiento: { ciclos: 3, enfoque: '"Mi cuerpo está preparado para el movimiento"' }
        },
        respuesta_tipo: 'estructurado'
      },
      contenido: 'Momentos de Aplicación Obligatoria:\n• Pre-Comida Principal: 3 ciclos · "Yo controlo mis decisiones alimentarias"\n• Pre-Entrenamiento: 3 ciclos · "Mi cuerpo está preparado para el movimiento"\n• Pre-Suplementación: 1 ciclo · "Elijo nutrir mi cuerpo conscientemente"\n\nFrase de Empoderamiento: "Yo controlo mis acciones; mis impulsos momentáneos no definen mi salud"',
      suplementacion: [
        { nombre: 'L-Teanina', dosis: '100mg', horario: '30 minutos antes', beneficio: 'Amplificar efecto calmante' },
        { nombre: 'Magnesio Glicinato', dosis: '200mg', horario: 'Pre-actividades', beneficio: 'Relajación muscular durante respiración' }
      ],
      principio: 'Potenciación con suplementos: L-Teanina (100mg) 30 minutos antes amplifica el efecto calmante; el magnesio facilita la relajación muscular durante la respiración.\n\nFrase de Empoderamiento: "Yo controlo mis acciones; mis impulsos momentáneos no definen mi salud"',
      recursos: []
    }
  },
  {
    dia_numero: 15, tipo_contenido: 'instructivo',
    titulo_modulo: 'Día 15: El Observador de la Incomodidad',
    emociones_objetivo: ['ira', 'miedo'],
    conclusion: 'Conclusión: La Pausa Poderosa.\n\nA lo largo de este bloque aprendiste que el autocontrol no es represión, sino la habilidad de crear un espacio consciente entre el estímulo y tu respuesta. Transformaste la teoría en disciplina consciente: gestionas estrés, sedentarismo y sueño como parte de un mismo sistema, tu bienestar integral.\n\nReflexión Final: "Entre el estímulo y la respuesta existe un espacio; en ese espacio está tu poder de elegir." Cada pausa de 5 minutos fue un acto de libertad: ya no eres pasajero de tus impulsos, eres el conductor de tu salud cardiovascular y metabólica.\n\nAl elegir con libertad y no por prohibición, dejaste de pelear contra tus deseos para guiarlos. Ese es el verdadero autocontrol: el que nace de la gestión, no de la negación.',
    datos_leccion: {
      titulo: 'El Observador de la Incomodidad',
      bloque: 'Autocontrol',
      concepto: 'Aprender a tolerar emociones incómodas sin buscar gratificación instantánea. La aceptación mindful reduce la evitación experiencial.',
      ejercicio: {
        nombre: 'Protocolo de Tolerancia Emocional',
        instruccion: 'Técnica "ABLANDAR-PERMITIR-AMAR" cuando aparezca tensión/ansiedad/incomodidad:\n\nPASO 1 · La lección: completa los 3 niveles de la técnica. PASO 2 · La reflexión: completa el Registro de Tolerancia (intensidad 1-10, duración y estrategia para cada emoción).',
        pasos: [
          { texto: '1) ABLANDAR (Nivel Físico - 30s): Siéntate cómodamente, localiza la tensión corporal específica, respira hacia esa zona, relaja conscientemente los músculos contraídos', respuesta_tipo: 'accion' },
          { texto: '2) PERMITIR (Nivel Mental - 60s): Observa pensamientos sin juzgarlos, describe la emoción ("Siento ansiedad en el pecho"), no busques distraerte inmediatamente, permite que la sensación exista como "nube pasajera"', respuesta_tipo: 'accion' },
          { texto: '3) AMAR (Nivel Emocional - 30s): Coloca mano en corazón, repite "Puedo estar con esto ahora", ofrécete compasión ("Es normal sentir esto"), reconoce tu valentía por no huir', respuesta_tipo: 'accion' },
          { texto: 'Ansiedad — intensidad ____/10 · duración real ____min · estrategia usada: ABLANDAR-PERMITIR-AMAR', respuesta_tipo: 'abierta' },
          { texto: 'Frustración — intensidad ____/10 · duración real ____min · estrategia usada: Respiración + observación', respuesta_tipo: 'abierta' },
          { texto: 'Aburrimiento — intensidad ____/10 · duración real ____min · estrategia usada: Tolerancia sin distracción', respuesta_tipo: 'abierta' }
        ],
        tipo: 'registro',
        respuesta_tipo: 'estructurado',
        registro: {
          ansiedad: { intensidad: '', duracion_real: '', estrategia_usada: 'ABLANDAR-PERMITIR-AMAR' },
          frustracion: { intensidad: '', duracion_real: '', estrategia_usada: 'Respiración + observación' },
          aburrimiento: { intensidad: '', duracion_real: '', estrategia_usada: 'Tolerancia sin distracción' }
        },
        respuesta_tipo: 'estructurado'
      },
      contenido: 'Meta del Bloque: al finalizar estos 5 días, habrás entrenado tu capacidad de navegar el estrés sin recurrir a mecanismos de escape dañinos para tu salud cardiovascular.',
      suplementacion: [
        { nombre: 'Omega-3 (EPA/DHA)', dosis: '1000mg', horario: 'Mañana', beneficio: 'Estabilidad del estado de ánimo' },
        { nombre: 'Ashwagandha', dosis: '300mg', horario: 'Mañana y noche', beneficio: 'Reducir reactividad al estrés' },
        { nombre: 'Magnesio Glicinato', dosis: '200mg', horario: 'Noche', beneficio: 'Relajación del sistema nervioso' }
      ],
      principio: 'Soporte para Regulación Emocional: Omega-3 (1000mg EPA/DHA) para estabilidad del estado de ánimo · Ashwagandha (300mg) para reducir la reactividad al estrés · Magnesio Glicinato (200mg) para relajación del sistema nervioso.',
      recursos: []
    }
  },
  {
    dia_numero: 16, tipo_contenido: 'instructivo',
    titulo_modulo: 'Día 16: El Viaje al Futuro (Visualización Neuroplástica)',
    emociones_objetivo: ['alegría', 'tristeza'],
    cabecera: `Bloque 4: Motivación y Proactividad (Días 16-20)\n\nTema Central: "Encontrando el Motor Interno: Del 'Tengo que' al 'Quiero'"\n\nTransformación Definitiva: Este bloque consolida la transición de la motivación externa volátil hacia un motor interno sostenible. Basado en la neurociencia de la motivación intrínseca, desarrollarás la capacidad de mantener el compromiso con tu bienestar desde valores profundos, no desde presión externa.\n\nLa motivación basada únicamente en la estética o en la presión social es volátil y suele desvanecerse ante el primer obstáculo. Para lograr un cambio de paradigma real en tu salud, necesitamos anclar tus acciones en valores intrínsecos profundos.\n\nEn este bloque, dejaremos atrás el "tengo que adelgazar" para abrazar el "quiero vivir con energía". La automotivación no es esperar a tener ganas de cuidarte; es la proactividad de asumir la responsabilidad de hacer que las cosas sucedan.\n\nAl conectar tu alimentación y tu movimiento con tu "porqué" profundo, dejas de ver los hábitos como una restricción y empiezas a verlos como el combustible necesario para alcanzar tus metas de vida y proteger la salud de tu corazón a largo plazo.`,
    datos_leccion: {
      titulo: 'El Viaje al Futuro (Visualización Neuroplástica)',
      bloque: 'Motivación',
      concepto: 'La motivación intrínseca se fortalece cuando visualizamos los beneficios de una salud cardiovascular y metabólica óptima a largo plazo. La visualización mental activa los mismos circuitos neuronales que la acción real, reforzando la motivación.',
      ejercicio: {
        nombre: 'Técnica de Visualización Multisensorial',
        instruccion: 'Protocolo de Visualización Científica (10-15 minutos):\n\nPreparación · 1) Posición: siéntate cómodamente, espalda recta · 2) Respiración: 3 ciclos 4-6-8 para activar estado alfa · 3) Intención: "Voy a programar mi cerebro para el éxito a largo plazo".\n\nVisualización Estructurada · Fase 1: Proyección Temporal (5 min) · Fase 2: Experiencia Sensorial Completa (5 min) · Fase 3: Conexión Emocional (3-5 min).',
        pasos: [
          { texto: '1) Fase 1 · Proyección Temporal (5 minutos): visualízate exactamente 10 años en el futuro · elige un lugar específico donde te ves · imagínate realizando algo que amas (viajar, jugar con nietos, practicar deporte)', respuesta_tipo: 'accion' },
          { texto: '2) Fase 2 · Experiencia Sensorial Completa (5 minutos): siente la fuerza de tus latidos, ritmo constante y poderoso · experimenta la profundidad de tu respiración sin fatiga · percibe la flexibilidad y fuerza de tus músculos al moverte · nota la claridad y vitalidad de tu mente', respuesta_tipo: 'accion' },
          { texto: '3) Fase 3 · Conexión Emocional (3-5 minutos): siente gratitud hacia tu "yo actual" por las decisiones que tomaste · experimenta la satisfacción de haber cuidado tu cuerpo durante años · conecta con el por qué profundo de tu transformación', respuesta_tipo: 'accion' }
        ],
        tipo: 'practica',
        respuesta_tipo: 'abierta'
      },
      contenido: 'La visualización repetida crea mapas neuronales que el cerebro interpreta como experiencias reales.',
      suplementacion: [
        { nombre: 'Rhodiola Rosea', dosis: '500mg', horario: '30 minutos antes', beneficio: 'Optimizar función cognitiva y visualización' },
        { nombre: 'Omega-3 (DHA/EPA)', dosis: '1000mg', horario: 'Mañana', beneficio: 'Soporte de neuroplasticidad y formación de nuevas conexiones' }
      ],
      principio: 'Principio Científico: la visualización repetida crea mapas neuronales que el cerebro interpreta como experiencias reales, aumentando la motivación para alcanzar esos estados futuros.',
      recursos: []
    }
  },
  {
    dia_numero: 17, tipo_contenido: 'cuestionario',
    titulo_modulo: 'Día 17: El Post-it de mi "Porqué" Vital',
    emociones_objetivo: ['alegría', 'tristeza'],
    datos_leccion: {
      titulo: 'El Post-it de mi "Porqué" Vital',
      bloque: 'Motivación',
concepto: 'La Teoría de la Autodeterminación (Deci & Ryan) demuestra que la motivación intrínseca surge cuando nuestras acciones están alineadas con valores personales profundos, no con presiones externas.',
      ejercicio: {
        nombre: 'Arqueología de Valores Profundos',
        instruccion: 'Proceso de Descubrimiento del "Porqué" Auténtico:\n\nPASO 1 · Excavación de Valores (10 minutos): responde las 5 preguntas progresivas.\nPASO 2 · Destilación del Propósito: completa la frase "Cuido mi salud integral porque quiero ___ para/con ___". Ejemplos: ✅ "Quiero viajar por el mundo con energía para crear memorias con mi familia" · ✅ "Quiero ser un ejemplo de vitalidad para inspirar a mis hijos" · ✅ "Quiero mantener mi independencia física para servir a mi comunidad" · ✅ "Quiero tener la energía mental para crear el impacto profesional que deseo".\nPASO 3 · Anclaje Visual y Físico: escribe tu "porqué" en un post-it, pégalo en un lugar estratégico y léelo en voz alta cada mañana durante 7 días.',
        pasos: [
          { texto: '1) ¿Qué es lo más importante para ti en la vida?', respuesta_tipo: 'abierta' },
          { texto: '2) ¿Por qué eso es importante?', respuesta_tipo: 'abierta' },
          { texto: '3) ¿Y por qué eso es importante para ti?', respuesta_tipo: 'abierta' },
          { texto: '4) ¿Qué sientes cuando imaginas que lo has perdido?', respuesta_tipo: 'abierta' },
          { texto: '5) ¿Cómo se relaciona tu salud con proteger eso que valoras?', respuesta_tipo: 'abierta' },
          { texto: '6) Paso 2 · Destilación del Propósito: completa "Cuido mi salud integral porque quiero ___ para/con ___"', respuesta_tipo: 'abierta' },
          { texto: '7) Paso 3 · Anclaje Visual y Físico: escribe tu "porqué" en un post-it con letra clara y grande · pégalo en un lugar estratégico (espejo del baño, refrigerador o escritorio) · ritual de conexión: léelo en voz alta cada mañana durante 7 días', respuesta_tipo: 'abierta' }
        ],
        tipo: 'reflexion',
        registro: { por_que: '', pegado_en: '' },
        respuesta_tipo: 'abierta'
      },
      contenido: 'Conectar acciones diarias con valores profundos activa el sistema de recompensa intrínseco.',
      suplementacion: [
        { nombre: 'Complejo B', dosis: '1 cápsula', horario: 'Mañana', beneficio: 'Optimizar función cognitiva y toma de decisiones' },
        { nombre: 'Ginkgo Biloba', dosis: '1 cápsula', horario: 'Mañana', beneficio: 'Mejorar circulación cerebral y claridad mental' }
      ],
      principio: 'Transformación: conectar acciones diarias con valores profundos activa el sistema de recompensa intrínseco, haciendo que el cuidado personal se sienta natural, no forzado.',
      recursos: []
    }
  },
  {
    dia_numero: 18, tipo_contenido: 'cuestionario',
    titulo_modulo: 'Día 18: Diseño de Entorno Proactivo (Arquitectura de Elección)',
    emociones_objetivo: ['alegría', 'tristeza'],
    datos_leccion: {
      titulo: 'Diseño de Entorno Proactivo (Arquitectura de Elección)',
      bloque: 'Motivación',
      concepto: 'La proactividad es la responsabilidad de diseñar las condiciones necesarias para que las decisiones saludables sean las más fáciles. La "arquitectura de elección" moldea comportamientos sin restricciones.',
      ejercicio: {
        nombre: 'Rediseño de Ecosistema Personal',
        instruccion: 'Protocolo de Optimización Ambiental:\n\nFASE 1 · Auditoría de Fricción Actual: identifica los puntos de fricción que dificultan tus decisiones saludables (marca su nivel de dificultad 1-10).\nFASE 2 · Rediseño de Facilidad: para cada comportamiento elimina fricción y crea facilidad.',
        pasos: [
          { texto: 'Auditoría · Tomar suplementos — están guardados en armario alto', respuesta_tipo: 'escala', min: 1, max: 10 },
          { texto: 'Auditoría · Beber agua suficiente — botella vacía y lejos', respuesta_tipo: 'escala', min: 1, max: 10 },
          { texto: 'Auditoría · Hacer ejercicio — ropa deportiva en otro cuarto', respuesta_tipo: 'escala', min: 1, max: 10 },
          { texto: 'Auditoría · Comer saludable — frutas escondidas en el refrigerador', respuesta_tipo: 'escala', min: 1, max: 10 },
          { texto: 'Rediseño · Estación de Bienestar Matutina: suplementos organizados + vaso de agua + post-it con tu "porqué", todo listo la noche anterior', respuesta_tipo: 'abierta' },
          { texto: 'Rediseño · Hidratación Automática: botella llena junto a la cama y otra en el escritorio · alarma cada 2 horas · saborizantes naturales disponibles', respuesta_tipo: 'abierta' },
          { texto: 'Rediseño · Activación de Movimiento: ropa deportiva lista la noche anterior · zapatos junto a la puerta · mat de yoga desplegado en lugar visible', respuesta_tipo: 'abierta' }
        ],
        tipo: 'registro',
        respuesta_tipo: 'abierta',
        registro: {
          friccion_suplementos: { comportamiento: 'Tomar suplementos', dificultad: '' },
          friccion_agua: { comportamiento: 'Beber agua suficiente', dificultad: '' },
          friccion_ejercicio: { comportamiento: 'Hacer ejercicio', dificultad: '' },
          friccion_comer: { comportamiento: 'Comer saludable', dificultad: '' },
          estacion_bienestar: { ubicacion: '', elementos: '', ritual: '' },
          hidratacion_automatica: { estrategia: '', recordatorio: '', facilitador: '' },
          activacion_movimiento: { preparacion: '', ubicacion_zapatos: '', recordatorio_visual: '' }
        },
      },
      contenido: 'Optimización de la Estación de Suplementos — Organización Estratégica por Horarios:\nMañana · Rhodiola + Complejo B · Pastillero transparente · Post-it en espejo\nPre-entrenamiento · L-Teanina (según necesidad) · Pequeño frasco portátil · En bolsa deportiva\nNoche · Magnesio · Pastillero nocturno · Junto al vaso de agua',
      suplementacion: [],
      principio: 'Principio de Arquitectura de Elección: cuando las decisiones saludables requieren menos esfuerzo que las no saludables, el cambio se vuelve automático y sostenible.',
      recursos: []
    }
  },
  {
    dia_numero: 19, tipo_contenido: 'instructivo',
    titulo_modulo: 'Día 19: Nutriendo la Energía, no la Balanza (Enfoque Metabólico)',
    emociones_objetivo: ['alegría', 'tristeza'],
    datos_leccion: {
      titulo: 'Nutriendo la Energía, no la Balanza (Enfoque Metabólico)',
      bloque: 'Motivación',
      concepto: 'Entender que la nutrición y la suplementación de calidad son el combustible para tus metas de vida, no solo para un número en la balanza. El enfoque en energía celular genera motivación sostenible.',
      ejercicio: {
        nombre: 'Auditoría Energética Consciente',
        instruccion: 'Protocolo de Conexión Nutricional durante tu comida principal de hoy:\n\nPASO 1 · Preparación Mindful (2 minutos): pausa pre-comida con 3 respiraciones conscientes · intención "Voy a nutrir mi energía celular" · gratitud por los alimentos que vas a consumir.\nPASO 2 · Identificación Nutricional Consciente: identifica el nutriente y beneficio energético de cada alimento de tu plato.\nPASO 3 · Conexión Propósito-Nutrición: repite mentalmente "Este [alimento] está proporcionando [nutriente] para que mi [órgano/sistema] pueda [función específica] y así yo pueda [meta personal]". Ejemplo: "Esta quinoa está proporcionando carbohidratos complejos para que mi cerebro pueda mantener concentración y así yo pueda ser productivo en mi trabajo".',
        pasos: [
          { texto: '1) Preparación Mindful: 3 respiraciones conscientes · intención "Voy a nutrir mi energía celular" · gratitud por los alimentos', respuesta_tipo: 'accion' },
          { texto: '2) Identificación Nutricional — Proteína: alimento ___ · reparación muscular y neurotransmisores', respuesta_tipo: 'abierta' },
          { texto: '3) Identificación Nutricional — Carbohidratos complejos: alimento ___ · energía sostenida para cerebro', respuesta_tipo: 'abierta' },
          { texto: '4) Identificación Nutricional — Grasas saludables: alimento ___ · absorción de vitaminas y hormonas', respuesta_tipo: 'abierta' },
          { texto: '5) Identificación Nutricional — Vitaminas/minerales: alimento ___ · cofactores para producción de ATP', respuesta_tipo: 'abierta' },
          { texto: '6) Conexión Propósito-Nutrición: completa "Este [alimento] está proporcionando [nutriente] para que mi [órgano/sistema] pueda [función específica] y así yo pueda [meta personal]"', respuesta_tipo: 'abierta' }
        ],
        tipo: 'registro',
        respuesta_tipo: 'abierta'
      },
      contenido: 'Beneficios del Enfoque Energético:\n• Motivación intrínseca: el foco en energía genera satisfacción inmediata\n• Sostenibilidad: no depende de fluctuaciones de peso\n• Conexión propósito: vincula nutrición con metas de vida reales',
      suplementacion: [
        { nombre: 'Coenzima Q10', dosis: '100mg', horario: 'Con desayuno', beneficio: 'Producción de ATP mitocondrial' },
        { nombre: 'Complejo B', dosis: '1 cápsula', horario: 'Mañana', beneficio: 'Metabolismo de macronutrientes' },
        { nombre: 'Magnesio Glicinato', dosis: '200mg', horario: 'Tarde', beneficio: 'Activación de ATP' },
        { nombre: 'Omega-3', dosis: '1000mg', horario: 'Con comida principal', beneficio: 'Función cerebral y energía mental' },
        { nombre: 'Rhodiola Rosea', dosis: '500mg', horario: 'Pre-actividades importantes', beneficio: 'Energía adaptógena' }
      ],
      principio: 'Cambio de Paradigma: de "comer para perder peso" a "nutrir para vivir plenamente".',
      recursos: []
    }
  },
  {
    dia_numero: 20, tipo_contenido: 'cuestionario',
    titulo_modulo: 'Día 20: El Compromiso con el "Quiero" (Consolidación Neurológica)',
    emociones_objetivo: ['alegría', 'tristeza'],
    conclusion: 'Conclusión: El Motor Interno Encendido.\n\nDejaste atrás el "tengo que adelgazar" para abrazar el "quiero vivir con energía". Anclaste tus acciones en valores profundos, no en presión externa, y consolidaste una motivación que no se desvanece ante el primer obstáculo.\n\nReflexión Final: "La motivación no es esperar a tener ganas; es recordar el porqué que ya tienes dentro." Al conectar tu alimentación y tu movimiento con tu propósito, los hábitos dejaron de ser restricciones para convertirse en el combustible de tus metas de vida.\n\nTu cerebro ya premia el cuidado como una elección propia y no como una obligación. Ese motor interno es tuyo: mantenlo encendido con la proactividad de hacer que las cosas sucedan.',
    datos_leccion: {
      titulo: 'El Compromiso con el "Quiero" (Consolidación Neurológica)',
      bloque: 'Motivación',
      concepto: 'Consolidar el cambio de paradigma del "tengo que" al "quiero" vivir con plenitud. La motivación intrínseca se fortalece cuando las acciones se perciben como elecciones libres alineadas con valores personales.',
      ejercicio: {
        nombre: 'Ritual de Consolidación de Identidad',
        instruccion: 'Protocolo de Cierre y Compromiso Futuro:\n\nPASO 1 · Revisión de Transformación (10 min): lee tu post-it del Día 17 y responde las 4 preguntas de integración.\nPASO 2 · Declaración de Compromiso Consciente: repite 3 veces con convicción "Elijo moverme, descansar y nutrirme porque quiero disfrutar de una vida plena. Mi cuerpo es mi hogar para toda la vida, y merece mi cuidado consciente y amoroso".\nPASO 3 · Diseño del Protocolo Personal Futuro: basado en tu experiencia, diseña tu suplementación personalizada (Suplemento __ · Dosis __ · Horario __ · Razón __), tus 3 prácticas no-negociables y tu recordatorio de "porqué" diario.',
        pasos: [
          { texto: '1) ¿Cómo ha cambiado mi relación con mi cuerpo en estos 20 días?', respuesta_tipo: 'abierta' },
          { texto: '2) ¿Qué decisión de bienestar me ha resultado más natural esta semana?', respuesta_tipo: 'abierta' },
          { texto: '3) ¿En qué momento sentí más claramente que "quería" en lugar de "tenía que"?', respuesta_tipo: 'abierta' },
          { texto: '4) ¿Cómo se siente mi energía comparada con el día 1?', respuesta_tipo: 'abierta' },
          { texto: '5) Paso 2 · Declaración de Compromiso Consciente: repite 3 veces en voz alta "Elijo moverme, descansar y nutrirme porque quiero disfrutar de una vida plena. Mi cuerpo es mi hogar para toda la vida, y merece mi cuidado consciente y amoroso"', respuesta_tipo: 'accion' },
          { texto: '6) Paso 3 · Mi Suplementación Personalizada: suplemento __ · dosis __ · horario __ · razón __ (completa hasta 3)', respuesta_tipo: 'abierta' },
          { texto: '7) Paso 3 · Mis 3 Prácticas No-Negociables: 1) ___ 2) ___ 3) ___', respuesta_tipo: 'abierta' },
          { texto: '8) Paso 3 · Mi Recordatorio de "Porqué" Diario: ___', respuesta_tipo: 'abierta' }
        ],
        tipo: 'reflexion',
        registro: {
          suplementacion_personalizada: [],
          practicas_no_negociables: ['', '', ''],
          recordatorio_por_que: ''
        },
        respuesta_tipo: 'estructurado'
      },
      contenido: 'Consolidación y Mantenimiento · Cierre Transformacional: cuidar tu corazón hoy es asegurar que tu motor interno tenga la potencia necesaria para llegar a donde deseas en la vida.\n\n"No se trata de ser perfecto; se trata de ser consciente, confiado, controlado y motivado desde adentro."\n\nTu Compromiso Sagrado: "Prometo honrar el trabajo que he hecho en estos 20 días. Prometo recordar que tengo el poder de elegir conscientemente. Prometo ser gentil conmigo mismo en el proceso y valiente en mis decisiones. Prometo vivir desde mi \'quiero\' más profundo, no desde mis \'tengo que\' superficiales."',
      suplementacion: [],
      principio: 'La Ciencia de tu Nueva Identidad — Cambios Neurológicos Documentados:\n• Corteza prefrontal fortalecida: mayor capacidad de planificación y autocontrol\n• Circuitos de recompensa optimizados: motivación intrínseca más activa que extrínseca\n• Sistema nervioso regulado: mejor alternancia entre activación y relajación\n• Neuroplasticidad dirigida: nuevos patrones neuronales que apoyan el bienestar.\n\nOptimización Bioquímica Integral:\n• Regulación del cortisol: mejor respuesta al estrés y recuperación\n• Estabilización de neurotransmisores: estado de ánimo más equilibrado\n• Optimización energética celular: producción de ATP más eficiente\n• Sincronización circadiana: ritmos biológicos más estables',
      recursos: []
    }
  },
  {
    dia_numero: 21, tipo_contenido: 'instructivo',
    titulo_modulo: 'Día 21: La Regla del Mejor Amigo (Neurociencia de la Autocompasión)',
    emociones_objetivo: ['alegría', 'tristeza'],
    cabecera: `Bloque 5: Empatía y Autocompasión\n\n"Autocompasión y Conexión con el Otro"\n\nTransformación Final: La empatía no solo se aplica a las personas, sino a aceptar que habrá días sin entrenamiento o noches de mal descanso. Lo importante es retomar con amor propio, no con castigo. Este bloque integra la neurociencia de la autocompasión con estrategias de conexión social y descanso reparador.\n\nEn el camino hacia una salud integral, la perfección es el enemigo de la constancia. La falta de autocompasión tras un error dietético o un día sin ejercicio suele conducir al "efecto de tirar la toalla", donde la culpa nos empuja a abandonar todo nuestro progreso.\n\nEn este bloque, aprenderemos que la empatía tiene una doble dirección: hacia los demás y, fundamentalmente, hacia uno mismo. Ser amable contigo cuando las cosas no salen según lo planeado es la herramienta más poderosa para retomar el rumbo con sabiduría en lugar de castigo.`,
    datos_leccion: {
      titulo: 'La Regla del Mejor Amigo (Neurociencia de la Autocompasión)',
      bloque: 'Empatía',
      concepto: 'La crítica interna feroz tras un fallo en la dieta o el ejercicio dispara el cortisol y sabotea el progreso. La autocompasión activa el sistema de cuidado, reduciendo la activación de la amígdala y promoviendo la recuperación.',
      ejercicio: {
        nombre: 'Protocolo de Autocompasión',
        instruccion: 'Técnica "ABLANDAR-PERMITIR-AMAR":\n\nPASO 1 · Identificación del Diálogo Interno Destructivo: cuando detectes autocrítica severa, completa los 3 campos.\nPASO 2 · Transformación Compasiva: imagina que tu mejor amigo/a te confiesa exactamente el mismo "fallo". Pregunta clave: "¿Qué le dirías a tu mejor amigo/a en esta situación?" Escribe tu respuesta compasiva.\nPASO 3 · Auto-aplicación de Compasión: lee en voz alta tu respuesta compasiva dirigida hacia ti: "[Tu nombre], [repite las palabras de aliento que escribiste]".',
        pasos: [
          { texto: '1) Paso 1 · Identificación del Diálogo Interno Destructivo — pensamiento autocrítico específico ___', respuesta_tipo: 'abierta' },
          { texto: '2) Paso 1 · Emoción que genera (culpa, vergüenza, frustración): ___', respuesta_tipo: 'abierta' },
          { texto: '3) Paso 1 · Sensación física (tensión, pesadez, contracción): ___', respuesta_tipo: 'abierta' },
          { texto: '4) Paso 2 · Transformación Compasiva: imagina que tu mejor amigo/a te confiesa exactamente el mismo "fallo". ¿Qué le dirías? Escribe tu respuesta compasiva: ___', respuesta_tipo: 'abierta' },
          { texto: '5) Paso 3 · Auto-aplicación de Compasión: lee en voz alta tu respuesta compasiva hacia ti: "[Tu nombre], [repite las palabras de aliento que escribiste]"', respuesta_tipo: 'accion' }
        ],
        tipo: 'reflexion',
        registro: { pensamiento_autocritico: '', emocion: '', sensacion_fisica: '', respuesta_compasiva: '' },
        respuesta_tipo: 'estructurado'
      },
      contenido: 'Hablarte con amabilidad reduce el estrés sistémico, permitiendo que tu corazón y metabolismo funcionen mejor.',
      suplementacion: [
        { nombre: 'Ashwagandha', dosis: '300mg', horario: 'Mañana', beneficio: 'Reducción de cortisol en 27.9%' },
        { nombre: 'L-Teanina', dosis: '200mg', horario: 'Según necesidad', beneficio: 'Activación de ondas alfa sin sedación' },
        { nombre: 'Magnesio Glicinato', dosis: '400mg', horario: 'Noche', beneficio: 'Regulación del sistema nervioso parasimpático' }
      ],
      principio: 'Principio Científico: hablarte con amabilidad reduce el estrés sistémico, permitiendo que tu corazón y metabolismo funcionen mejor. La autocompasión activa el nervio vago y reduce la inflamación.',
      recursos: []
    }
  },
  {
    dia_numero: 22, tipo_contenido: 'cuestionario',
    titulo_modulo: 'Día 22: Nota de Re-enfoque (Protocolo Sin Castigo)',
    emociones_objetivo: ['alegría', 'tristeza'],
    datos_leccion: {
      titulo: 'Nota de Re-enfoque (Protocolo Sin Castigo)',
      bloque: 'Empatía',
concepto: 'Un "desliz" es solo un dato, no una definición de quién eres. La neuroplasticidad permite que cada momento sea una oportunidad de redirección, no de castigo.',
      ejercicio: {
        nombre: 'Protocolo de Redirección Consciente',
        instruccion: 'Cuando experimentes un "desliz" (alimentario, ejercicio o autocuidado), completa tu Nota de Re-enfoque:\n\nFormato de Nota de Redirección Consciente:\nFecha ___ · Situación ___ · Mi respuesta ___ · Dato que esto me enseña ___ · Mi próxima acción de autocuidado ___ · Razón por la que elijo esta acción ___ · Firma de autocompasión ___.\n\nEjemplos de Redirección Saludable: · Comí en exceso → ❌ Saltarme la próxima comida → ✅ Caminata suave + hidratación · No hice ejercicio → ❌ Doble sesión mañana → ✅ Estiramientos de 10 min hoy · Dormí mal → ❌ Cafeína excesiva → ✅ Magnesio + siesta de 20 min.',
        pasos: [
          { texto: '1) Fecha: ___', respuesta_tipo: 'abierta' },
          { texto: '2) Situación: ___', respuesta_tipo: 'abierta' },
          { texto: '3) Mi respuesta: ___', respuesta_tipo: 'abierta' },
          { texto: '4) Dato que esto me enseña: ___', respuesta_tipo: 'abierta' },
          { texto: '5) Mi próxima acción de autocuidado: ___', respuesta_tipo: 'abierta' },
          { texto: '6) Razón por la que elijo esta acción: ___', respuesta_tipo: 'abierta' },
          { texto: '7) Firma de autocompasión: ___', respuesta_tipo: 'abierta' }
        ],
        tipo: 'registro',
        respuesta_tipo: 'abierta',
        registro: {
          fecha: '',
          situacion: '',
          mi_respuesta: '',
          dato_que_ensenia: '',
          proxima_accion_autocuidado: '',
          razon_eleccion: '',
          firma_autocompasion: ''
        },
      },
      contenido: 'Palabras de Redirección: "El autocuidado es un proceso continuo, no una línea recta de perfección. Cada momento es una nueva oportunidad de elegir mi bienestar."',
      suplementacion: [
        { nombre: 'Rhodiola Rosea', dosis: '500mg', horario: 'Según necesidad', beneficio: 'Resiliencia adaptógena ante el estrés' },
        { nombre: 'Omega-3 (EPA/DHA)', dosis: '1000mg', horario: 'Con comida', beneficio: 'Estabilización del estado de ánimo post-estrés' }
      ],
      principio: 'El autocuidado es un proceso continuo, no una línea recta de perfección. Cada momento es una nueva oportunidad de elegir mi bienestar.',
      recursos: []
    }
  },
  {
    dia_numero: 23, tipo_contenido: 'instructivo',
    titulo_modulo: 'Día 23: Gratitud Cardiovascular y Corporal (Oxitocina)',
    emociones_objetivo: ['alegría', 'tristeza'],
    datos_leccion: {
      titulo: 'Gratitud Cardiovascular y Corporal (Oxitocina)',
      bloque: 'Empatía',
      concepto: 'La empatía hacia el propio cuerpo es reconocer que trabaja 24/7 por nosotros. La gratitud libera oxitocina, que dilata los vasos sanguíneos, reduce la presión arterial y protege el corazón.',
      ejercicio: {
        nombre: 'Ritual de Gratitud Cardiovascular',
        instruccion: 'Protocolo de Conexión Corazón-Mente (5-7 minutos):\n\nFASE 1 · Conexión Física (2 min): siéntate con espalda recta, coloca mano derecha sobre el corazón y mano izquierda sobre el abdomen · respira profundamente hacia las manos · siente el ritmo cardíaco durante 1 minuto completo.\nFASE 2 · Gratitud Específica (3 min): mantén las manos en posición y agradece mentalmente. Cardiovascular: "Gracias, corazón, por latir [número de latidos] veces cada minuto sin que yo tenga que recordártelo" · "Gracias por bombear sangre oxigenada a cada célula de mi cuerpo" · "Gracias por adaptarte cuando hago ejercicio y relajarte cuando descanso". Muscular: "Gracias, músculos, por sostenerme y permitirme moverme" · "Gracias por recuperaros después del ejercicio y fortaleceros cada día" · "Gracias por la energía que me brindan para realizar mis actividades".\nFASE 3 · Compromiso de Cuidado (2 min): "Cuidar mi corazón con [nombre del suplemento cardiovascular] es un acto de amor propio y responsabilidad hacia un órgano que nunca descansa por mí".',
        pasos: [
          { texto: '1) Fase 1 · Conexión Física (2 min): mano derecha sobre el corazón, mano izquierda sobre el abdomen · respira profundamente hacia las manos · siente el ritmo cardíaco durante 1 minuto', respuesta_tipo: 'accion' },
          { texto: '2) Fase 2 · Gratitud Específica (3 min): agradece a tu corazón por latir sin que lo recuerdes, por bombear sangre oxigenada y por adaptarse al ejercicio y al descanso; agradece a tus músculos por sostenerte, recuperarse y darte energía', respuesta_tipo: 'accion' },
          { texto: '3) Fase 3 · Compromiso de Cuidado (2 min): "Cuidar mi corazón con [nombre del suplemento cardiovascular] es un acto de amor propio y responsabilidad hacia un órgano que nunca descansa por mí"', respuesta_tipo: 'accion' }
        ],
        tipo: 'practica',
        respuesta_tipo: 'abierta'
      },
      contenido: 'Conexión Científica: la gratitud activa el sistema nervioso parasimpático, mejorando la variabilidad de la frecuencia cardíaca y reduciendo la inflamación sistémica.',
      suplementacion: [
        { nombre: 'Cardiosmile', dosis: '1 sachet', horario: 'Después del almuerzo', beneficio: 'Soporte integral cardiovascular' },
        { nombre: 'Coenzima Q10', dosis: '100mg', horario: 'Con comida principal', beneficio: 'Energía celular cardíaca' },
        { nombre: 'Omega-3', dosis: '1000mg EPA/DHA', horario: 'Con cena', beneficio: 'Protección cardiovascular' },
        { nombre: 'Magnesio', dosis: '400mg', horario: 'Noche', beneficio: 'Relajación del músculo cardíaco' }
      ],
      principio: 'Soporte Cardiovascular Específico — Salud Cardíaca: Cardiosmile 1 sachet después del almuerzo para soporte integral · Coenzima Q10 100mg con comida principal para energía celular cardíaca · Omega-3 1000mg EPA/DHA con cena para protección cardiovascular · Magnesio 400mg a la noche para relajación del músculo cardíaco.',
      recursos: []
    }
  },
  {
    dia_numero: 24, tipo_contenido: 'instructivo',
    titulo_modulo: 'Día 24: Empatía con el Entorno (Salud Social y Oxitocina)',
    emociones_objetivo: ['alegría', 'tristeza'],
    datos_leccion: {
      titulo: 'Empatía con el Entorno (Salud Social y Oxitocina)',
      bloque: 'Empatía',
      concepto: 'Los conflictos con los demás a menudo disparan la ingesta emocional como mecanismo de escape. La conexión social empática libera oxitocina, que reduce el cortisol y mejora la regulación emocional.',
      ejercicio: {
        nombre: 'Protocolo de Empatía Preventiva',
        instruccion: 'Técnica de "Pausa Empática" en Interacciones Desafiantes, antes de reaccionar con impaciencia o frustración:\n\nPASO 1 · Pausa Fisiológica (30s): 3 ciclos de respiración 4-6-8 · afloja hombros y mandíbula conscientemente · centramiento: siente tus pies en el suelo.\nPASO 2 · Reencuadre Empático (30s): repite mentalmente "Esta persona también está lidiando con sus propias cargas. Su comportamiento refleja su estado interno, no mi valor personal".\nPASO 3 · Respuesta Consciente (variable): elige desde la calma, no desde la reactividad · Opción A: respuesta empática directa · Opción B: pausa para procesar antes de responder · Opción C: establecimiento de límites saludables.\n\nRegistro de Interacciones Empáticas (completa 3 filas): Situación Desafiante · Reacción Inicial · Pausa Empática Aplicada · Resultado.',
        pasos: [
          { texto: '1) Pausa Fisiológica (30s): 3 ciclos de respiración 4-6-8 · afloja hombros y mandíbula · siente tus pies en el suelo', respuesta_tipo: 'accion' },
          { texto: '2) Reencuadre Empático (30s): "Esta persona también está lidiando con sus propias cargas. Su comportamiento refleja su estado interno, no mi valor personal"', respuesta_tipo: 'accion' },
          { texto: '3) Respuesta Consciente: elige desde la calma · Opción A: respuesta empática directa · Opción B: pausa para procesar · Opción C: límites saludables', respuesta_tipo: 'accion' },
          { texto: '4) Registro de Interacciones Empáticas #1: situación desafiante · reacción inicial · pausa empática aplicada · resultado', respuesta_tipo: 'abierta' },
          { texto: '5) Registro de Interacciones Empáticas #2: situación desafiante · reacción inicial · pausa empática aplicada · resultado', respuesta_tipo: 'abierta' },
          { texto: '6) Registro de Interacciones Empáticas #3: situación desafiante · reacción inicial · pausa empática aplicada · resultado', respuesta_tipo: 'abierta' }
        ],
        tipo: 'registro',
        registro: { situacion_desafiante: '', reaccion_inicial: '', pausa_empatica_aplicada: '', resultado: '' },
        respuesta_tipo: 'estructurado'
      },
      contenido: 'Beneficio Integral: cultivar relaciones sanas protege tu salud mental y evita que utilices la comida como consuelo ante el estrés interpersonal.',
      suplementacion: [
        { nombre: 'L-Teanina', dosis: '200mg', horario: 'Según necesidad', beneficio: 'Mantener calma en interacciones estresantes' },
        { nombre: 'GABA', dosis: 'Según indicación', horario: 'Según necesidad', beneficio: 'Reducir reactividad social y ansiedad' },
        { nombre: 'Complejo B', dosis: '1 cápsula', horario: 'Mañana', beneficio: 'Soporte del sistema nervioso durante estrés interpersonal' }
      ],
      principio: 'Cultivar relaciones sanas protege tu salud mental y evita la alimentación emocional.',
      recursos: []
    }
  },
  {
    dia_numero: 25, tipo_contenido: 'cuestionario',
    titulo_modulo: 'Día 25: El Permiso del Descanso Real (Neurobiología de la Recuperación)',
    emociones_objetivo: ['alegría', 'tristeza'],
    conclusion: 'Palabras Finales: El Poder de la Empatía Integral.\n\nEn un mundo que constantemente te invita a ser tu peor crítico, has elegido el camino más revolucionario: convertirte en tu mejor aliado.\n\nHas desarrollado la capacidad más transformadora que existe: la habilidad de amarte a ti mismo incondicionalmente mientras sigues creciendo.\n\nQue cada día de tu vida sea una expresión de esta autocompasión. Que cada decisión refleje el amor propio que has cultivado. Que cada respiración te recuerde que mereces tu propia gentileza.',
    datos_leccion: {
      titulo: 'El Permiso del Descanso Real (Neurobiología de la Recuperación)',
      bloque: 'Empatía',
      concepto: 'La falta de autocompasión a menudo se disfraza de exigencia excesiva que lleva al agotamiento. El descanso reparador es esencial para la regulación hormonal, la consolidación de la memoria y la recuperación celular.',
      ejercicio: {
        nombre: 'Protocolo de Descanso Consciente',
        instruccion: 'Auditoría de Señales de Agotamiento — Evaluación Matutina (escala 1-10):\n\nInterpretación de Resultados: · 0-15: energía óptima, continúa tu rutina normal · 16-25: fatiga moderada, implementa descanso activo · 26-40: agotamiento significativo, descanso obligatorio.\n\nProtocolo de Descanso Según Nivel — Descanso Activo (16-25): 15-30 minutos de meditación, estiramientos suaves o lectura; L-Teanina (200mg) para relajación sin sedación. Descanso Profundo (26-40): 1-2 horas o siesta de 20-30 minutos, silencio total, baño relajante o música suave; Magnesium relax (Magnesio + teanina).\n\nRitual de Permiso de Descanso: cuando tu cuerpo pida descanso, di en voz alta "Me doy permiso para descansar. Mi cuerpo ha trabajado duro y merece recuperación. Descansar no es pereza; es sabiduría."',
        pasos: [
          { texto: 'Evaluación Matutina · Fatiga física — mi nivel actual', respuesta_tipo: 'escala', min: 1, max: 10 },
          { texto: 'Evaluación Matutina · Niebla mental — mi nivel actual', respuesta_tipo: 'escala', min: 1, max: 10 },
          { texto: 'Evaluación Matutina · Irritabilidad emocional — mi nivel actual', respuesta_tipo: 'escala', min: 1, max: 10 },
          { texto: 'Evaluación Matutina · Motivación reducida — mi nivel actual', respuesta_tipo: 'escala', min: 1, max: 10 },
          { texto: 'Suma tus puntuaciones (total /40): 0-15 energía óptima · 16-25 descanso activo · 26-40 descanso obligatorio', respuesta_tipo: 'accion' }
        ],
        tipo: 'registro',
        respuesta_tipo: 'escala',
        registro: {
          fatiga_fisica: '___/10',
          niebla_mental: '___/10',
          irritabilidad_emocional: '___/10',
          motivacion_reducida: '___/10',
          total: '___/40',
          interpretacion: '',
          protocolo_elegido: ''
        },
      },
      contenido: 'Principio de Bienestar Integral: el bienestar incluye darte el combustible para actuar, pero también el permiso para recuperarte. El descanso es productividad diferida, no tiempo perdido.\n\nTu Legado de Empatía: al vivir desde estos principios empáticos, no solo transformas tu propia vida; te conviertes en un faro de compasión para otros. Tu presencia, tu ejemplo, tu forma de tratarte a ti mismo comunica una verdad poderosa: "Es posible ser gentil contigo mismo. Es posible elegir la autocompasión. Es posible ser tu mejor aliado."\n\nLa Invitación Permanente a la Empatía: cada día que despiertes tienes la oportunidad de elegir · ¿Me hablaré con la voz de un crítico interno o de un mejor amigo? · ¿Responderé a mis errores con castigo o con redirección compasiva? · ¿Trataré a otros desde mi herida o desde mi sanación? · ¿Me daré permiso para descansar cuando lo necesite?\n\nTu Compromiso Sagrado de Autocompasión: "Prometo ser mi mejor aliado en este viaje de vida. Prometo hablarme con la misma gentileza que ofrecería a un ser querido. Prometo recordar que soy humano, y que ser humano incluye la imperfección. Prometo elegir la autocompasión como mi superpoder secreto."',
      suplementacion: [
        { nombre: 'Magnesio Glicinato', dosis: '400mg', horario: '2 horas antes de dormir', beneficio: 'Relajación muscular y mental' },
        { nombre: 'Melatonina', dosis: '1-2mg', horario: '1 hora antes de dormir', beneficio: 'Regulación del ciclo circadiano' },
        { nombre: 'L-Teanina', dosis: '200mg', horario: 'Con magnesio', beneficio: 'Calma sin interferir con sueño' },
        { nombre: 'Ashwagandha', dosis: '300mg', horario: 'Noche', beneficio: 'Reducción de cortisol nocturno' }
      ],
      principio: 'Recuperación y Descanso — Protocolo de Optimización del Sueño: Magnesio Glicinato 400mg 2 horas antes de dormir · Melatonina 1-2mg 1 hora antes · L-Teanina 200mg junto al magnesio · Ashwagandha 300mg a la noche. El descanso es productividad diferida, no tiempo perdido.',
      recursos: []
    }
  },
  {
    dia_numero: 26, tipo_contenido: 'instructivo',
    titulo_modulo: 'Día 26: El Guion de la Asertividad Saludable (Neurociencia Social)',
    emociones_objetivo: ['alegría', 'ira'],
    cabecera: `Bloque 6: Competencia Social y Asertividad\n\n"Navegando el Entorno Social: Límites y Celebración"\n\nTransformación Social Definitiva: Aquí es donde demuestras que tu cambio es sólido, aprendiendo a convivir en entornos sociales (fiestas, cenas familiares, reuniones de trabajo) sin que el entorno sabotee tu salud cardiovascular, nutrición o bienestar mental. La competencia social es la habilidad de mantener tu estilo de vida saludable frente a la presión de grupo sin aislarte.\n\nA menudo, el entorno social se convierte en el mayor saboteador de nuestros hábitos saludables. Sin embargo, la verdadera salud integral no consiste en aislarse para "cumplir", sino en desarrollar las habilidades sociales necesarias para disfrutar de la vida sin descuidar tu bienestar.\n\nEn estos últimos 5 días, aprenderemos que puedes socializar, celebrar y compartir con los demás manteniendo tus límites con asertividad y sin rastro de culpa.`,
    datos_leccion: {
      titulo: 'El Guion de la Asertividad Saludable (Neurociencia Social)',
      bloque: 'Competencia Social',
      concepto: 'La competencia social es la habilidad de mantener el estilo de vida saludable frente a la presión de grupo sin aislarse. La asertividad activa la corteza prefrontal y reduce la activación de la amígdala ante conflictos sociales.',
      ejercicio: {
        nombre: 'Protocolo de Asertividad Neurológica',
        instruccion: 'Técnica de Preparación Mental para Eventos Sociales:\n\nFASE 1 · Identificación de Escenarios Desafiantes: identifica 3 situaciones sociales próximas donde podrías enfrentar presión (Evento Social · Presión Esperada · Nivel de Desafío 1-10).\nFASE 2 · Desarrollo de Guiones Asertivos: para cada escenario prepara 3 frases. Fórmula de Asertividad Saludable: "[Reconocimiento] + [Límite claro] + [Alternativa positiva]".\n\nEjemplos de Guiones Preparados — Presión para comer: ✅ "Se ve delicioso, pero estoy satisfecho/a. Gracias por pensar en mí" · ✅ "Aprecio que me ofrezcas, pero mi cuerpo se siente mejor cuando elijo conscientemente" · ✅ "Gracias por insistir, pero prefiero mantener mi energía estable hoy". Presión para beber alcohol: ✅ "Hoy elijo no beber alcohol, prefiero mantener mi claridad mental" · ✅ "Estoy disfrutando mucho la conversación sin necesidad de alcohol" · ✅ "Mi cuerpo me agradece cuando elijo hidratarme con agua". Críticas por tu estilo de vida: ✅ "Entiendo que puede parecer diferente, pero me siento muy bien así" · ✅ "Cada persona encuentra su forma de cuidarse, esta es la mía" · ✅ "Respeto tu perspectiva, y espero que respetes la mía también".',
        pasos: [
          { texto: '1) Fase 1 · Escenario Social #1: evento social ___ · presión esperada ___ · nivel de desafío ____/10', respuesta_tipo: 'abierta' },
          { texto: '2) Fase 1 · Escenario Social #2: evento social ___ · presión esperada ___ · nivel de desafío ____/10', respuesta_tipo: 'abierta' },
          { texto: '3) Fase 1 · Escenario Social #3: evento social ___ · presión esperada ___ · nivel de desafío ____/10', respuesta_tipo: 'abierta' },
          { texto: '4) Fase 2 · Guión asertivo #1 con la fórmula [Reconocimiento] + [Límite claro] + [Alternativa positiva]: ___', respuesta_tipo: 'abierta' },
          { texto: '5) Fase 2 · Guión asertivo #2 con la fórmula [Reconocimiento] + [Límite claro] + [Alternativa positiva]: ___', respuesta_tipo: 'abierta' },
          { texto: '6) Fase 2 · Guión asertivo #3 con la fórmula [Reconocimiento] + [Límite claro] + [Alternativa positiva]: ___', respuesta_tipo: 'abierta' }
        ],
        tipo: 'registro',
        registro: {
          escenario_1: '', presion_esperada: '', guion_asertivo: '',
          escenario_2: '', presion_esperada_2: '', guion_asertivo_2: '',
          escenario_3: '', presion_esperada_3: '', guion_asertivo_3: ''
        },
        respuesta_tipo: 'estructurado'
      },
      contenido: 'Principio Científico: practicar límites claros reduce el estrés social, protegiendo tu equilibrio emocional y tu presión arterial en entornos compartidos.',
      suplementacion: [],
      principio: 'Principio Científico: practicar límites claros reduce el estrés social, protegiendo tu equilibrio emocional y tu presión arterial en entornos compartidos.',
      recursos: []
    }
  },
  {
    dia_numero: 27, tipo_contenido: 'cuestionario',
    titulo_modulo: 'Día 27: La "Estrategia de Pre-Carga" (Bienestar Proactivo)',
    emociones_objetivo: ['alegría', 'ira'],
    datos_leccion: {
      titulo: 'La "Estrategia de Pre-Carga" (Bienestar Proactivo)',
      bloque: 'Competencia Social',
      concepto: 'El entorno social es a menudo el mayor saboteador de los hábitos; la planificación proactiva es tu mejor defensa. La preparación reduce la carga cognitiva y preserva la fuerza de voluntad.',
      ejercicio: {
        nombre: 'Protocolo de Pre-Carga Integral',
        instruccion: 'Sistema de Preparación Estratégica para Eventos Sociales:\n\nPRE-CARGA NUTRICIONAL (2-3 horas antes): comida equilibrada (proteína + carbohidratos complejos + grasas saludables) · hidratación óptima (500ml de agua + electrolitos) · suplementación estratégica según protocolo del día anterior.\nPRE-CARGA MENTAL (30 minutos antes): revisión de guiones asertivos · visualización positiva del evento con confianza · conexión con tu propósito (tu "porqué" del Día 17).\nPRE-CARGA EMOCIONAL (15 minutos antes): respiración reguladora (5 ciclos 4-6-8) · afirmación "Puedo disfrutar socialmente mientras cuido mi bienestar" · intención clara "Voy a conectar auténticamente con otros desde mi centro".\n\nKit de Emergencia Social: botella de agua · L-Teanina (200mg) para ansiedad aguda · snack saludable (nueces, fruta) · recordatorio visual (foto de tu "porqué" en el teléfono).',
        pasos: [
          { texto: '1) Pre-Carga Nutricional (2-3 horas antes): comida equilibrada (proteína + carbohidratos complejos + grasas saludables) · 500ml de agua + electrolitos · suplementación estratégica', respuesta_tipo: 'accion' },
          { texto: '2) Pre-Carga Mental (30 minutos antes): repasa tus guiones asertivos · visualízate navegando el evento con confianza · recuerda tu "porqué" del Día 17', respuesta_tipo: 'accion' },
          { texto: '3) Pre-Carga Emocional (15 minutos antes): 5 ciclos de respiración 4-6-8 · "Puedo disfrutar socialmente mientras cuido mi bienestar" · "Voy a conectar auténticamente con otros desde mi centro"', respuesta_tipo: 'accion' },
          { texto: '4) Kit de Emergencia Social: botella de agua · L-Teanina (200mg) · snack saludable (nueces, fruta) · recordatorio visual (foto de tu "porqué" en el teléfono)', respuesta_tipo: 'accion' }
        ],
        tipo: 'practica',
        respuesta_tipo: 'abierta',
        registro: {
          pre_carga_nutricional: { comida: '', hidratacion: '', suplementacion: '' },
          pre_carga_mental: { guiones_revisados: '', visualizacion: '', conexion_proposito: '' },
          pre_carga_emocional: { respiracion_reguladora: '', afirmacion: '', intencion: '' },
          kit_emergencia_social: ['botella_agua', 'L-Teanina', 'snack_saludable', 'recordatorio_visual']
        },
      },
      contenido: 'Principio de Preparación Inteligente: no llegar con hambre física o ansiedad al evento te permite elegir desde la razón y no desde el impulso emocional.',
      suplementacion: [
        { nombre: 'L-Teanina', dosis: '200mg', horario: 'Antes del evento', beneficio: 'Manejo de ansiedad aguda social' }
      ],
      principio: 'No llegar con hambre física o ansiedad al evento te permite elegir desde la razón y no desde el impulso emocional.',
      recursos: []
    }
  },
  {
    dia_numero: 28, tipo_contenido: 'instructivo',
    titulo_modulo: 'Día 28: Conexión Humana sobre el Consumo (Inteligencia Interpersonal)',
    emociones_objetivo: ['alegría', 'ira'],
    datos_leccion: {
      titulo: 'Conexión Humana sobre el Consumo (Inteligencia Interpersonal)',
      bloque: 'Competencia Social',
      concepto: 'Desplazar el foco del placer desde la comida hiperpalatable hacia la inteligencia interpersonal. La conexión social auténtica libera oxitocina, que reduce el cortisol y fortalece el sistema inmunológico.',
      ejercicio: {
        nombre: 'Protocolo de Conexión Consciente',
        instruccion: 'Técnica de "Socialización Mindful":\n\nPREPARACIÓN PRE-INTERACCIÓN: intención clara "Voy a enfocarme en conocer genuinamente a las personas" · objetivo específico "Aprenderé algo nuevo sobre al menos 2 personas" · recordatorio "La comida es el contexto, la conexión es el propósito".\nDURANTE LA INTERACCIÓN — Protocolo de Escucha Activa: presencia física (contacto visual y postura abierta) · preguntas genuinas que demuestren interés real · escucha profunda (entender, no responder). Ejemplos de preguntas: "¿Qué te ha emocionado más últimamente?" · "¿En qué proyecto personal estás trabajando?" · "¿Qué has aprendido recientemente que te haya sorprendido?" · "¿Cuál ha sido el mejor momento de tu semana?".\nTÉCNICA DE REDIRECCIÓN SOCIAL cuando la conversación se centre en comida/bebida — Fórmula: "[Reconocimiento] + [Transición] + [Pregunta personal]". Ejemplos: "Está delicioso, gracias. Por cierto, ¿cómo va tu proyecto de...?" · "Aprecio la recomendación. Cuéntame, ¿qué planes tienes para...?" · "Se ve increíble. Cambiando de tema, ¿has probado alguna actividad nueva últimamente?".\n\nREGISTRO DE CONEXIONES AUTÉNTICAS (3 filas): Persona · Algo Nuevo que Aprendí · Conexión Emocional (1-10).',
        pasos: [
          { texto: '1) Preparación: intención clara "Voy a enfocarme en conocer genuinamente a las personas" · objetivo "Aprenderé algo nuevo sobre al menos 2 personas" · "La comida es el contexto, la conexión es el propósito"', respuesta_tipo: 'accion' },
          { texto: '2) Durante la interacción · Escucha Activa: contacto visual y postura abierta · preguntas genuinas · escucha profunda (entender, no responder)', respuesta_tipo: 'accion' },
          { texto: '3) Redirección Social: si la conversación se centra en comida/bebida, aplica "[Reconocimiento] + [Transición] + [Pregunta personal]"', respuesta_tipo: 'accion' },
          { texto: '4) Registro de Conexiones Auténticas #1: persona ___ · algo nuevo que aprendí ___ · conexión emocional ____/10', respuesta_tipo: 'abierta' },
          { texto: '5) Registro de Conexiones Auténticas #2: persona ___ · algo nuevo que aprendí ___ · conexión emocional ____/10', respuesta_tipo: 'abierta' },
          { texto: '6) Registro de Conexiones Auténticas #3: persona ___ · algo nuevo que aprendí ___ · conexión emocional ____/10', respuesta_tipo: 'abierta' }
        ],
        tipo: 'registro',
        registro: {
          conexion_1: { persona: '', algo_nuevo_aprendido: '', conexion_emocional: '' },
          conexion_2: { persona: '', algo_nuevo_aprendido: '', conexion_emocional: '' },
          conexion_3: { persona: '', algo_nuevo_aprendido: '', conexion_emocional: '' }
        },
        respuesta_tipo: 'estructurado'
      },
      contenido: 'Beneficio Integral: disfrutar de los vínculos afectivos reduce el cortisol y fortalece tu sistema inmunológico, demostrando que puedes celebrar sin comprometer tu bienestar.',
      suplementacion: [
        { nombre: 'Omega-3 (EPA/DHA)', dosis: '1000mg', horario: 'Mañana', beneficio: 'Estabilidad emocional en interacciones' },
        { nombre: 'Complejo B', dosis: '1 cápsula', horario: 'Mañana', beneficio: 'Energía mental sostenida para conversaciones' },
        { nombre: 'L-Teanina', dosis: '100mg', horario: 'Según necesidad', beneficio: 'Calma y presencia durante interacciones intensas' }
      ],
      principio: 'La comida es el contexto, la conexión es el propósito.',
      recursos: []
    }
  },
  {
    dia_numero: 29, tipo_contenido: 'instructivo',
    titulo_modulo: 'Día 29: El "No" que es un "Sí" a tu Futuro (Autoeficacia Social)',
    emociones_objetivo: ['alegría', 'ira'],
    datos_leccion: {
      titulo: 'El "No" que es un "Sí" a tu Futuro (Autoeficacia Social)',
      bloque: 'Competencia Social',
      concepto: 'La capacidad de decir "no" a las presiones externas es un ejercicio de autoeficacia y respeto hacia tus valores intrínsecos. Cada límite que estableces refuerza tu identidad como protagonista de tu propia historia.',
      ejercicio: {
        nombre: 'Protocolo de Límites Empoderados',
        instruccion: 'Técnica de "Límites como Inversión en el Futuro":\n\nFASE 1 · Identificación de Saboteadores Sociales: identifica personas que presionan contra tus decisiones saludables (Persona · Tipo de Presión · Frecuencia/semana · Estrategia Necesaria).\nFASE 2 · Desarrollo de Límites Específicos: fórmula de Límite Empoderado "[Reconocimiento de la relación] + [Límite claro] + [Conexión con valores futuros]". Ejemplos: presión alimentaria persistente → "Valoro mucho nuestra amistad, y por eso necesito que respetes mis decisiones alimentarias. Estoy invirtiendo en mi salud a largo plazo" · críticas sobre tu estilo de vida → "Entiendo que mi forma de cuidarme puede parecer diferente, pero es importante para mí mantener mi energía y vitalidad para los próximos años" · presión para abandonar rutinas → "Aprecio que quieras pasar tiempo conmigo. Podemos encontrar formas de conectar que también honren mi compromiso con mi bienestar".\nFASE 3 · Visualización de Límites Exitosos: visualiza la situación de presión · siente tu centro (respiración y postura) · escucha tu respuesta (voz firme pero amable) · observa el resultado (mantén tu postura con confianza).',
        pasos: [
          { texto: '1) Fase 1 · Saboteador Social #1: persona ___ · tipo de presión ___ · frecuencia ___/semana · estrategia necesaria ___', respuesta_tipo: 'abierta' },
          { texto: '2) Fase 1 · Saboteador Social #2: persona ___ · tipo de presión ___ · frecuencia ___/semana · estrategia necesaria ___', respuesta_tipo: 'abierta' },
          { texto: '3) Fase 1 · Saboteador Social #3: persona ___ · tipo de presión ___ · frecuencia ___/semana · estrategia necesaria ___', respuesta_tipo: 'abierta' },
          { texto: '4) Fase 2 · Límite Empoderado #1 con la fórmula [Reconocimiento de la relación] + [Límite claro] + [Conexión con valores futuros]: ___', respuesta_tipo: 'abierta' },
          { texto: '5) Fase 2 · Límite Empoderado #2 con la fórmula [Reconocimiento de la relación] + [Límite claro] + [Conexión con valores futuros]: ___', respuesta_tipo: 'abierta' },
          { texto: '6) Fase 2 · Límite Empoderado #3 con la fórmula [Reconocimiento de la relación] + [Límite claro] + [Conexión con valores futuros]: ___', respuesta_tipo: 'abierta' },
          { texto: '7) Fase 3 · Visualización de Límites Exitosos: visualiza el momento de presión · siente tu centro (respiración y postura) · escucha tu respuesta con voz firme pero amable · observa manteniendo tu postura con confianza', respuesta_tipo: 'abierta' }
        ],
        tipo: 'registro',
        registro: {
          saboteador_1: '', tipo_presion: '', frecuencia: '', estrategia: '',
          saboteador_2: '', tipo_presion_2: '', frecuencia_2: '', estrategia_2: '',
          saboteador_3: '', tipo_presion_3: '', frecuencia_3: '', estrategia_3: '',
          limite_1: '', limite_2: '', limite_3: ''
        },
        respuesta_tipo: 'estructurado'
      },
      contenido: 'Reencuadre Empoderador: mantener tu estilo de vida frente a otros refuerza tu identidad como "protagonista" de tu propia historia. Cada "no" a la presión externa es un "sí" a tu futuro saludable.',
      suplementacion: [],
      principio: 'Cada "no" a la presión externa es un "sí" a tu futuro saludable.',
      recursos: []
    }
  },
  {
    dia_numero: 30, tipo_contenido: 'cuestionario',
    titulo_modulo: 'Día 30: Recapitulación y Compromiso de Vida',
    emociones_objetivo: ['alegría', 'ira'],
    conclusion: 'Conclusión Final: El Comienzo de Todo.\n\nCompletaste los 30 días de IEN, y no terminaste un programa: comenzaste una nueva forma de vivir. Demostraste que se puede socializar, celebrar y compartir sin renunciar a la salud, manteniendo límites asertivos y sin rastro de culpa.\n\nReflexión Final: "La verdadera libertad no es aislarse para cumplir, sino poder estar con los demás sin dejar de ser tú." Tu entorno ya no te sabotea: lo navegas con seguridad y disfrutas de cada momento.\n\nHoy cierras un ciclo con autoconciencia, confianza, autocontrol, motivación y empatía integrados en tu vida. Este es solo el comienzo de tu bienestar auténtico: cada día a partir de ahora, honra lo que construiste.',
    datos_leccion: {
      titulo: 'Recapitulación y Compromiso de Vida (Consolidación de Competencia Social)',
      bloque: 'Competencia Social',
      concepto: 'La Inteligencia Emocional es una "caja de herramientas" que te servirá de por vida para navegar tu mundo interior y social. La consolidación de aprendizajes requiere reflexión consciente y compromiso futuro.',
      ejercicio: {
        nombre: 'Ritual de Graduación y Compromiso',
        instruccion: 'Protocolo de Cierre y Proyección Futura:\n\nFASE 1 · Auditoría de Transformación de 30 Días (15 min): refresca tu mayor victoria por bloque — 1-5 Autoconciencia · 6-10 Autoconfianza · 11-15 Autocontrol · 16-20 Motivación · 21-25 Empatía · 26-30 Competencia Social. Pregunta de Reflexión Profunda: ¿Cuál fue tu mayor victoria en estos 30 días? (¿Más energía?, ¿Mejor control de impulsos?, ¿Mayor autocompasión?, ¿Límites más claros?)\nFASE 2 · Diseño de Protocolo Personal de Mantenimiento: suplementación personalizada (Suplemento __ · Dosis __ · Horario __ · Razón Específica __ hasta 4) y tus 5 prácticas no-negociables.\nFASE 3 · Compromiso Simbólico de Mantenimiento: escribe a mano la Carta a tu Futuro Yo con los 5 compromisos y tu mensaje personal de aliento.',
        pasos: [
          { texto: '1) Fase 1 · Mayor victoria en Bloque 1-5 (Autoconciencia): ___', respuesta_tipo: 'abierta' },
          { texto: '2) Fase 1 · Mayor victoria en Bloque 6-10 (Autoconfianza): ___', respuesta_tipo: 'abierta' },
          { texto: '3) Fase 1 · Mayor victoria en Bloque 11-15 (Autocontrol): ___', respuesta_tipo: 'abierta' },
          { texto: '4) Fase 1 · Mayor victoria en Bloque 16-20 (Motivación): ___', respuesta_tipo: 'abierta' },
          { texto: '5) Fase 1 · Mayor victoria en Bloque 21-25 (Empatía): ___', respuesta_tipo: 'abierta' },
          { texto: '6) Fase 1 · Mayor victoria en Bloque 26-30 (Competencia Social): ___', respuesta_tipo: 'abierta' },
          { texto: '7) Fase 1 · Reflexión Profunda: ¿cuál fue tu mayor victoria en estos 30 días (más energía, mejor control de impulsos, mayor autocompasión, límites más claros)?', respuesta_tipo: 'abierta' },
          { texto: '8) Fase 2 · Mi Suplementación Personalizada para la Vida #1: suplemento __ · dosis __ · horario __ · razón específica __ (completa hasta 4)', respuesta_tipo: 'abierta' },
          { texto: '9) Fase 2 · Mis 5 Prácticas No-Negociables: 1) ___ 2) ___ 3) ___ 4) ___ 5) ___', respuesta_tipo: 'abierta' },
          { texto: '10) Fase 3 · Carta a tu Futuro Yo: "Querido/a [tu nombre] del futuro... me comprometo a 1) mantener ___ 2) continuar ___ 3) honrar mis límites en ___ 4) recordar que mi porqué es ___ 5) ser compasivo/a cuando ___. Si estás leyendo esto y has perdido el rumbo, recuerda: [mensaje de aliento]"', respuesta_tipo: 'abierta' }
        ],
        tipo: 'registro',
        registro: {
          mayor_victoria_global: '',
          victoria_bloque_1_5: '',
          victoria_bloque_6_10: '',
          victoria_bloque_11_15: '',
          victoria_bloque_16_20: '',
          victoria_bloque_21_25: '',
          victoria_bloque_26_30: '',
          suplementacion_futura: [],
          practicas_no_negociables: ['', '', '', '', ''],
          carta_futuro_yo: ''
        },
        respuesta_tipo: 'estructurado'
      },
      contenido: 'Consolidación y Mantenimiento de por Vida:\nProtocolo Base Diario Mínimo: Ashwagandha (300mg) para manejo sostenible del estrés · Complejo B para energía mental y emocional consistente · Magnesio Glicinato (400mg) para recuperación y sueño · Omega-3 (1000mg) para estabilidad emocional y función cerebral.\n\nPotenciadores según Situación: L-Teanina para eventos sociales desafiantes o estrés agudo · Rhodiola Rosea para días de alta demanda energética o mental · Cardiosmile + CoQ10 para soporte cardiovascular continuo.\n\nCierre Transformacional: firma un compromiso simbólico para mantener estas herramientas como parte de tu rutina diaria de cuidado integral con suplementación de calidad.',
      suplementacion: [
        { nombre: 'Ashwagandha', dosis: '300mg', horario: 'Diario', beneficio: 'Manejo sostenible del estrés social' },
        { nombre: 'Complejo B', dosis: '1 cápsula', horario: 'Diario', beneficio: 'Energía mental y emocional consistente' },
        { nombre: 'Magnesio Glicinato', dosis: '400mg', horario: 'Noche', beneficio: 'Recuperación y calidad de sueño' },
        { nombre: 'Omega-3', dosis: '1000mg', horario: 'Diario', beneficio: 'Estabilidad emocional y función cerebral' },
        { nombre: 'Cardiosmile + CoQ10', dosis: '1 sachet + 100mg', horario: 'Diario', beneficio: 'Soporte cardiovascular continuo' }
      ],
      principio: 'Cierre Transformacional: cada "no" a la presión externa y cada "sí" a tu bienestar refuerzan tu identidad como protagonista de tu propia historia. Has desarrollado un protocolo interno de competencia social: RECONOCE → CENTRA → EVALÚA → COMUNICA → MANTIENE → CONECTA.',
      recursos: []
    }
  }
];

// Test inicial: 30 preguntas, 5 por competencia
// Orden: interleaved — ciclo de 6 competencias, 5 rondas (preguntas 1-30)
// ---------------------------------------------------------------------------
const TEST_PREGUNTAS = [
  { numero: 1,  competencia: 'autoconciencia',    texto: 'Soy consciente de las reacciones físicas (gestos, dolores, cambios súbitos) que indican una "reacción visceral".' },
  { numero: 2,  competencia: 'autoconfianza',     texto: 'Admito de buena gana mis errores y me disculpo.' },
  { numero: 3,  competencia: 'autocontrol',       texto: 'No me aferro a los problemas, enfados o heridas del pasado, soy capaz de dejarlos atrás para avanzar.' },
  { numero: 4,  competencia: 'empatia',           texto: 'Normalmente tengo una idea exacta de cómo me percibe la otra persona durante una interacción específica.' },
  { numero: 5,  competencia: 'motivacion',        texto: 'Hay varias cosas importantes en mi vida que me entusiasman, y lo hago patente.' },
  { numero: 6,  competencia: 'competencia_social',texto: 'Tengo facilidad para conocer e iniciar conversaciones con personas desconocidas cuando tengo que hacerlo.' },
  { numero: 7,  competencia: 'autoconciencia',    texto: 'Me tomo un descanso o utilizo otro método activo para incrementar mi energía cuando percibo que mi nivel energético decae.' },
  { numero: 8,  competencia: 'autoconfianza',     texto: 'No me cuesta demasiado asumir riesgos prudentes.' },
  { numero: 9,  competencia: 'autocontrol',       texto: 'Me "abro" a las personas en la medida adecuada, no demasiado, pero lo suficiente como para no dar la impresión de ser frío y distante.' },
  { numero: 10, competencia: 'empatia',           texto: 'Puedo participar en una interacción con otra persona y captar bastante bien cuál es su estado de ánimo en base a las señales no verbales que me envía.' },
  { numero: 11, competencia: 'motivacion',        texto: 'Normalmente, otros se sienten inspirados y animados después de hablar conmigo.' },
  { numero: 12, competencia: 'competencia_social',texto: 'No tengo ningún problema a la hora de hacer una presentación a un grupo o dirigir una reunión.' },
  { numero: 13, competencia: 'autoconciencia',    texto: 'Cada día dedico algo de tiempo a la reflexión.' },
  { numero: 14, competencia: 'autoconfianza',     texto: 'Yo tomo la iniciativa y sigo adelante con las tareas que es necesario hacer.' },
  { numero: 15, competencia: 'autocontrol',       texto: 'Me abstengo de formarme una opinión sobre los temas y de expresar esa opinión hasta que no conozco todos los hechos.' },
  { numero: 16, competencia: 'empatia',           texto: 'Cuento con varias personas a las que puedo recurrir y pedir ayuda cuando lo necesito.' },
  { numero: 17, competencia: 'motivacion',        texto: 'Intento encontrar el lado positivo en cualquier situación.' },
  { numero: 18, competencia: 'competencia_social',texto: 'Soy capaz de afrontar con calma, sensibilidad y de manera proactiva las manifestaciones y los despliegues emocionales de otras personas.' },
  { numero: 19, competencia: 'autoconciencia',    texto: 'Normalmente soy capaz de identificar el tipo de emoción que siento en un momento dado.' },
  { numero: 20, competencia: 'autoconfianza',     texto: 'Por lo general me siento cómodo ante situaciones nuevas.' },
  { numero: 21, competencia: 'autocontrol',       texto: 'No escondo mi enfado pero tampoco lo pago con otros.' },
  { numero: 22, competencia: 'empatia',           texto: 'Puedo demostrar empatía y acoplar mis sentimientos a los de la otra persona en una interacción.' },
  { numero: 23, competencia: 'motivacion',        texto: 'Soy capaz de seguir adelante en un proyecto importante a pesar de los obstáculos.' },
  { numero: 24, competencia: 'competencia_social',texto: 'Los demás me respetan y les caigo bien, incluso cuando no están de acuerdo conmigo.' },
  { numero: 25, competencia: 'autoconciencia',    texto: 'Tengo muy claro cuáles son mis propias metas y valores.' },
  { numero: 26, competencia: 'autoconfianza',     texto: 'Expreso mis puntos de vista con honestidad y ponderación, sin agobiar.' },
  { numero: 27, competencia: 'autocontrol',       texto: 'Puedo controlar mis estados de ánimo y muy raras veces llevo las emociones negativas al trabajo.' },
  { numero: 28, competencia: 'empatia',           texto: 'Centro toda mi atención en la otra persona cuando estoy escuchándolo.' },
  { numero: 29, competencia: 'motivacion',        texto: 'Creo que el trabajo que hago cada día tiene sentido y aporta valor a la sociedad.' },
  { numero: 30, competencia: 'competencia_social',texto: 'Puedo persuadir eficazmente a otros para que adopten mi punto de vista sin coaccionarles.' }
];

// ---------------------------------------------------------------------------
// Contenidos especiales: bienvenida, presentación, reflexión 15 y 30 días
// ---------------------------------------------------------------------------
const CONTENIDOS_ESPECIALES = [
  {
    tipo: 'bienvenida',
    titulo: 'Bienvenido al Programa IEN',
    contenido: {
      programa: {
        nombre: 'Cuidamos de tu mente y de tu corazón',
        subtitulo: '30 días de Inteligencia Emocional con Cardiosmile y Vitamin Shoppe'
      },
      introduccion: 'En solo 30 días, puedes transformar completamente tu relación contigo mismo y con el mundo que te rodea. No se trata de cambios superficiales o promesas vacías; se trata de una revolución interna respaldada por la ciencia y diseñada para durar toda la vida.',
      viaje_transformacion: {
        titulo: 'Tu Viaje de Transformación',
        intro: 'Imagínate dentro de 30 días:',
        puntos: [
          'Despertando cada mañana con claridad mental y energía auténtica',
          'Navegando cualquier situación social con confianza y asertividad',
          'Tomando decisiones desde tus valores más profundos, no desde impulsos',
          'Siendo tu mejor aliado en lugar de tu peor crítico',
          'Manteniendo tu bienestar sin sacrificar conexiones genuinas'
        ]
      },
      competencias_maestras: {
        titulo: 'Más que un Programa: Una Nueva Forma de Vivir',
        descripcion: 'Este no es otro programa de bienestar temporal. Es el desarrollo de seis competencias maestras de la inteligencia emocional que transformarán cada área de tu vida:',
        cita: 'No se trata de ser perfecto; se trata de ser consciente, confiado, controlado, motivado, empático y socialmente competente.',
        nota: 'Cada día construye sobre el anterior. Cada técnica se integra naturalmente en tu vida. Cada suplemento tiene un propósito específico respaldado por ciencia. Cada ejercicio te acerca a la versión más auténtica y poderosa de ti mismo.'
      },
      momento_es_ahora: {
        titulo: 'Tu Momento es Ahora',
        descripcion: 'En un mundo que constantemente te invita a buscar soluciones externas, tienes la oportunidad de elegir el camino más revolucionario: entrenar tu inteligencia emocional',
        frases_impacto: [
          '30 días para transformar 30 años de patrones automáticos',
          '30 días para construir la confianza que siempre has deseado',
          '30 días para convertirte en el protagonista de tu propia historia'
        ],
        pregunta: '¿Estás listo para descubrir quién puedes llegar a ser?'
      },
      cierre: 'Tu transformación integral comienza con una sola decisión: elegir invertir en ti mismo. Bienvenido a tu nueva vida. Bienvenido a tu verdadero poder.',
      cita_final: 'El momento en que decides transformarte es el momento en que todo cambia. No esperes el momento perfecto; créalo.'
    }
  },
  {
    tipo: 'presentacion',
    titulo: 'Presentación del Programa IEN',
    contenido: {
      descripcion: 'El Programa IEN integra la neurociencia de las emociones con estrategias de nutrición y suplementación para generar cambios sostenibles en tu estilo de vida.',
      metodologia: 'Cada día recibirás contenido instructivo o un cuestionario de reflexión, acompañado de recomendaciones de suplementación específicas para cada competencia emocional.',
      estructura: {
        duracion: '30 días',
        bloques: 6,
        dias_por_bloque: 5,
        tipos_contenido: ['instructivo', 'cuestionario'],
        suplementacion_integrada: true
      },
      equipo: 'Desarrollado por especialistas en inteligencia emocional, neurociencia aplicada y nutrición integrativa.'
    }
  },
  {
    tipo: 'reflexion_15_dias',
    titulo: 'Reflexión de Mitad de Programa (Día 15)',
    contenido: {
      titulo: 'El Viaje de 15 Días hacia la Transformación Integral',
      progresion_consciente: {
        texto: 'Al completar la mitad de este programa, has emprendido un viaje extraordinario que va mucho más allá de simples cambios en la dieta o rutinas de ejercicio. Has desarrollado las tres competencias fundamentales que distinguen a las personas que logran transformaciones duraderas.',
        cita: 'La verdadera transformación no ocurre cuando cambias lo que haces, sino cuando cambias quién eres.'
      },
      evolucion_etapas: [
        {
          titulo: 'Días 1-5: Del Piloto Automático al Observador Consciente',
          texto: 'Has aprendido a reconocer tus señales internas antes de que se conviertan en acciones automáticas. Esta autoconciencia es el fundamento sobre el cual se construye toda transformación auténtica.'
        },
        {
          titulo: 'Días 6-10: De la Víctima al Protagonista de tu Historia',
          texto: 'Has reescrito tu narrativa interna, transformando etiquetas limitantes en identidades empoderadas. Los micro-compromisos cumplidos han demostrado a tu cerebro que eres capaz de mantener promesas contigo mismo.'
        },
        {
          titulo: 'Días 11-15: Del Impulso al Dominio Consciente',
          texto: 'Has desarrollado la capacidad más sofisticada del ser humano: el autocontrol inteligente. Has aprendido a navegar la incomodidad emocional sin recurrir a mecanismos de escape.'
        }
      ],
      ciencia_transformacion: [
        'Tu corteza prefrontal se ha fortalecido a través de la práctica repetida del autocontrol',
        'Tus ritmos circadianos se han estabilizado mediante rutinas consistentes',
        'Tu sistema nervioso ha aprendido a alternar eficientemente entre activación y relajación',
        'Tu identidad neurológica se ha reorganizado a través de la neuroplasticidad dirigida'
      ],
      agradecimiento: {
        titulo: 'Un Agradecimiento Especial',
        puntos: [
          'A tu valentía por comprometerte con este proceso cuando hubiera sido más fácil seguir en piloto automático.',
          'A tu constancia por elegir la práctica diaria incluso en días difíciles.',
          'A tu apertura por permitir que la ciencia y la sabiduría se encuentren en tu experiencia personal.'
        ]
      },
      cita_final: 'No se trata de ser perfecto; se trata de ser consciente. No se trata de no caer nunca; se trata de levantarse con sabiduría.',
      firma: 'Lic. Gladys C. Patiño - Nutricionista Funcional. Int Emocional en Nut y Salud. Nut y Salud Mental. Neurociencias'
    }
  },
  {
    tipo: 'reflexion_30_dias',
    titulo: 'Reflexión de Cierre del Programa (Día 30)',
    contenido: {
      titulo: 'La Transformación de 30 Días: El Viaje Completo',
      cita_apertura: 'La verdadera transformación no es solo cambiar lo que haces en privado, sino mantener esos cambios con gracia y confianza en cualquier entorno social.',
      evolucion_dimensiones: [
        { dias: '1-5', competencia: 'AUTOCONCIENCIA', transformacion: 'Del piloto automático a la elección consciente', resultado: 'Capacidad de reconocer señales internas antes de actuar' },
        { dias: '6-10', competencia: 'AUTOCONFIANZA', transformacion: 'De "no puedo" a "elijo conscientemente"', resultado: 'Identidad empoderada basada en evidencia de capacidad' },
        { dias: '11-15', competencia: 'AUTOCONTROL', transformacion: 'Del impulso al dominio consciente', resultado: 'Gestión inteligente de emociones y estímulos' },
        { dias: '16-20', competencia: 'MOTIVACIÓN', transformacion: 'De "tengo que" a "quiero vivir plenamente"', resultado: 'Motivación intrínseca alineada con valores profundos' },
        { dias: '21-25', competencia: 'EMPATÍA INTEGRAL', transformacion: 'De autocrítica destructiva a autocompasión nutritiva', resultado: 'Capacidad de ser tu mejor aliado y conectar empáticamente' },
        { dias: '26-30', competencia: 'COMPETENCIA SOCIAL', transformacion: 'De aislamiento o capitulación a asertividad empática', resultado: 'Habilidad de mantener tu bienestar conectando auténticamente' }
      ],
      ciencia_transformacion: {
        cambios_neurologicos: [
          'Corteza prefrontal fortalecida: Mayor capacidad de planificación y autocontrol social',
          'Circuitos de asertividad activados: Comunicación clara sin agresividad ni pasividad',
          'Redes de empatía social optimizadas: Mejor regulación emocional en interacciones complejas'
        ],
        optimizacion_bioquimica: [
          'Regulación del cortisol social: Mejor respuesta al estrés interpersonal',
          'Liberación de oxitocina por conexión: Mejora en vínculos sociales y salud cardiovascular',
          'Estabilización de neurotransmisores: Estado de ánimo equilibrado en entornos sociales'
        ]
      },
      sistema_operativo_social: {
        titulo: 'Tu Nuevo Sistema Operativo Social Integral',
        ciclo: [
          { paso: 'RECONOCE', descripcion: 'Identifica presión social o conflicto interpersonal', competencia_base: 'Autoconciencia' },
          { paso: 'CENTRA', descripcion: 'Conecta con tu respiración y valores', competencia_base: 'Autoconfianza' },
          { paso: 'EVALÚA', descripcion: 'Considera opciones desde tu identidad empoderada', competencia_base: 'Autocontrol' },
          { paso: 'COMUNICA', descripcion: 'Expresa límites o necesidades con asertividad empática', competencia_base: 'Competencia Social' },
          { paso: 'MANTIENE', descripcion: 'Sostiene tu posición desde amor propio', competencia_base: 'Empatía Integral' },
          { paso: 'CONECTA', descripcion: 'Busca puntos de conexión auténtica', competencia_base: 'Automotivación' }
        ]
      },
      legado: 'Es posible ser auténtico en cualquier entorno. Es posible cuidarse sin aislarse. Es posible conectar genuinamente sin comprometer tu bienestar.',
      compromiso_sagrado: 'Prometo honrar mi autenticidad en cualquier entorno social. Prometo comunicar mis límites con claridad y compasión. Prometo buscar conexión genuina, no aprobación superficial. Prometo recordar que mi bienestar es un regalo que ofrezco al mundo, no un lujo que debo sacrificar.',
      firma: 'Lic. Gladys C. Patiño - Nutricionista Funcional. Int Emocional en Nut y Salud. Nut y Salud Mental. Neurociencias'
    }
  }
];

// ---------------------------------------------------------------------------
// Función principal
// ---------------------------------------------------------------------------
async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Conectado a MongoDB');

  const onlyContent = process.argv.includes('--only-content');

  if (onlyContent) {
    await Promise.all([
      ContenidoDiario.deleteMany({}),
      TestPregunta.deleteMany({}),
      ContenidoEspecial.deleteMany({})
    ]);
    console.log('Colecciones de contenido limpiadas (--only-content)');
  } else {
    await Promise.all([
      Tienda.deleteMany({}),
      Usuario.deleteMany({}),
      ContenidoDiario.deleteMany({}),
      TestPregunta.deleteMany({}),
      ContenidoEspecial.deleteMany({}),
      Producto.deleteMany({}),
      Codigo.deleteMany({}),
      PlanProgreso.deleteMany({}),
      HistorialCorreo.deleteMany({})
    ]);
    console.log('Colecciones limpiadas');

  // 1. Tiendas
  const tiendas = await Tienda.insertMany([
    { nombre_tienda: 'CardioSmille', ciudad: 'Asunción, Paraguay' },
    { nombre_tienda: 'The Vitamin Shoppe', ciudad: 'Asunción, Paraguay' },
    { nombre_tienda: 'Lic. Gladys', ciudad: 'Asunción, Paraguay' }
  ]);
  console.log(`${tiendas.length} tiendas creadas`);
  const tCardio = tiendas[0];
  const tVitamin = tiendas[1];
  const tGladys = tiendas[2];

  // 2. Productos
  const productos = await Producto.insertMany([
    {
      nombre: 'Programa 30 días Cardiosmile — CardioSmille',
      descripcion: 'Plan cardiovascular completo',
      tienda_id: tCardio._id
    },
    {
      nombre: 'Programa 30 días Cardiosmile — The Vitamin Shoppe',
      descripcion: 'Plan cardiovascular completo',
      tienda_id: tVitamin._id
    },
    {
      nombre: 'Programa 30 días Cardiosmile — Lic. Gladys',
      descripcion: 'Plan cardiovascular completo',
      tienda_id: tGladys._id
    },
    {
      nombre: 'Programa Especial Ashwagandha — CardioSmille',
      descripcion: 'Plan de autogestión y reducción de estrés',
      tienda_id: tCardio._id
    },
    {
      nombre: 'Programa Especial Ashwagandha — The Vitamin Shoppe',
      descripcion: 'Plan de autogestión y reducción de estrés',
      tienda_id: tVitamin._id
    }
  ]);
  console.log(`${productos.length} productos creados`);
  const prodCardio1 = productos[0];
  const prodCardio2 = productos[1];
  const prodCardio3 = productos[2];
  const prodAshwa1 = productos[3];
  const prodAshwa2 = productos[4];

  // 3. Códigos
  const codigos = await Codigo.insertMany([
    { codigo: 'IEN-001', producto_id: prodCardio1._id, tienda_id: tCardio._id, activo: true },
    { codigo: 'IEN-002', producto_id: prodCardio2._id, tienda_id: tVitamin._id, activo: true },
    { codigo: 'IEN-003', producto_id: prodCardio3._id, tienda_id: tGladys._id, activo: true },
    { codigo: 'IEN-004', producto_id: prodAshwa1._id, tienda_id: tCardio._id, activo: true },
    { codigo: 'IEN-005', producto_id: prodAshwa2._id, tienda_id: tVitamin._id, activo: true }
  ]);
  console.log(`${codigos.length} códigos de activación creados`);

  // 4. Usuarios Administradores
  const password_hash = await bcrypt.hash('admin123', 10);

  await Usuario.create({
    nombre: 'Admin General',
    email: 'admin@ien.test',
    password_hash,
    rol: 'admin_general'
  });
  console.log('Admin General creado: admin@ien.test / admin123');

  await Usuario.create({
    nombre: 'Admin Negocio Cardio-Vitamin',
    email: 'admin_negocio@ien.test',
    password_hash,
    rol: 'admin_negocio',
    tiendas_administradas: [tCardio._id, tVitamin._id]
  });
  console.log('Admin Negocio creado: admin_negocio@ien.test / admin123');

  await Usuario.create({
    nombre: 'Moderador CardioSmille',
    email: 'moderador@ien.test',
    password_hash,
    rol: 'moderador_tienda',
    tienda_moderada: tCardio._id
  });
  console.log('Moderador Tienda creado: moderador@ien.test / admin123');

  // 5. Usuarios regulares (12 usuarios paraguayos con distribución variada de progreso)
  const userPassword = await bcrypt.hash('demo123', 10);

  const usuariosDemo = [
    { nombre: 'Liz Román',      email: 'liz.roman@demo.com',      tienda: tCardio,  producto: prodCardio1, codigo: 'IEN-001' },
    { nombre: 'Carlos Benítez', email: 'carlos.benitez@demo.com', tienda: tVitamin, producto: prodCardio2, codigo: 'IEN-002' },
    { nombre: 'María Ferreira', email: 'maria.ferreira@demo.com', tienda: tGladys,  producto: prodCardio3, codigo: 'IEN-003' },
    { nombre: 'Juan Rojas',     email: 'juan.rojas@demo.com',     tienda: tCardio,  producto: prodAshwa1,  codigo: 'IEN-004' },
    { nombre: 'Ana López',      email: 'ana.lopez@demo.com',      tienda: tVitamin, producto: prodAshwa2,  codigo: 'IEN-005' },
    { nombre: 'Pedro Martínez', email: 'pedro.martinez@demo.com',  tienda: tGladys,  producto: prodCardio3, codigo: 'IEN-003' },
    { nombre: 'Lucía González', email: 'lucia.gonzalez@demo.com',  tienda: tCardio,  producto: prodCardio1, codigo: 'IEN-001' },
    { nombre: 'Diego Agüero',   email: 'diego.aguero@demo.com',   tienda: tVitamin, producto: prodAshwa2,  codigo: 'IEN-005' },
    { nombre: 'Carla Duarte',   email: 'carla.duarte@demo.com',   tienda: tGladys,  producto: prodCardio3, codigo: 'IEN-003' },
    { nombre: 'José Riveros',   email: 'jose.riveros@demo.com',   tienda: tCardio,  producto: prodAshwa1,  codigo: 'IEN-004' },
    { nombre: 'Natalia Ruiz',   email: 'natalia.ruiz@demo.com',   tienda: tVitamin, producto: prodCardio2, codigo: 'IEN-002' },
    { nombre: 'Ricardo Vera',   email: 'ricardo.vera@demo.com',   tienda: tGladys,  producto: prodAshwa2,  codigo: 'IEN-005' },
    { nombre: 'Sofía Cáceres',  email: 'sofia.caceres@demo.com',  tienda: tCardio,  producto: prodCardio1, codigo: 'IEN-001' },
    { nombre: 'Miguel Ayala',   email: 'miguel.ayala@demo.com',   tienda: tVitamin, producto: prodCardio2, codigo: 'IEN-002' },
    { nombre: 'Raquel Insfrán', email: 'raquel.insfran@demo.com', tienda: tGladys,  producto: prodCardio3, codigo: 'IEN-003' }
  ];

  const usuariosCreados = [];
  const createdDates = [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < usuariosDemo.length; i++) {
    const u = usuariosDemo[i];
    const fechaReg = new Date(today);
    fechaReg.setDate(fechaReg.getDate() - (14 - i));
    createdDates.push(fechaReg);

    const usuario = await Usuario.create({
      nombre: u.nombre,
      email: u.email,
      password_hash: userPassword,
      rol: 'usuario',
      tienda_id: u.tienda._id,
      producto_id: u.producto._id,
      codigo_activacion: u.codigo,
      fecha_registro: fechaReg
    });
    usuariosCreados.push(usuario);
    console.log(`Usuario creado: ${u.email} / demo123`);
  }

  // 6. Planes de Progreso (distribución variada)
  const COMPETENCIA_KEYS = ['autoconciencia', 'autoconfianza', 'autocontrol', 'empatia', 'motivacion', 'competencia_social'];

  const planesConfig = [
    { idx: 0,  dia_actual: 4,  inicio_hace: 3,  estado: 'activo',     racha_max: 4,  hitos: [], ultima_hace: 0 },
    { idx: 1,  dia_actual: 5,  inicio_hace: 4,  estado: 'activo',     racha_max: 5,  hitos: [], ultima_hace: 0 },
    { idx: 2,  dia_actual: 10, inicio_hace: 9,  estado: 'activo',     racha_max: 8,  hitos: [7], ultima_hace: 1 },
    { idx: 3,  dia_actual: 12, inicio_hace: 11, estado: 'activo',     racha_max: 10, hitos: [7], ultima_hace: 0 },
    { idx: 4,  dia_actual: 16, inicio_hace: 15, estado: 'activo',     racha_max: 12, hitos: [7], ultima_hace: 3 },
    { idx: 5,  dia_actual: 18, inicio_hace: 17, estado: 'activo',     racha_max: 14, hitos: [7, 14], ultima_hace: 4 },
    { idx: 6,  dia_actual: 8,  inicio_hace: 17, estado: 'abandonado', racha_max: 8,  hitos: [7], ultima_hace: 10, racha_dias: 0 },
    { idx: 7,  dia_actual: 25, inicio_hace: 24, estado: 'activo',     racha_max: 18, hitos: [7, 14], ultima_hace: 0 },
    { idx: 8,  dia_actual: 28, inicio_hace: 27, estado: 'activo',     racha_max: 20, hitos: [7, 14], ultima_hace: 1 },
    { idx: 9,  dia_actual: 29, inicio_hace: 28, estado: 'activo',     racha_max: 22, hitos: [7, 14, 21], ultima_hace: 2 },
    { idx: 10, dia_actual: 31, inicio_hace: 29, estado: 'completado', racha_max: 24, hitos: [7, 14, 21], ultima_hace: 3 },
    { idx: 11, dia_actual: 31, inicio_hace: 29, estado: 'completado', racha_max: 26, hitos: [7, 14, 21], ultima_hace: 4 },
    { idx: 12, dia_actual: 2,  inicio_hace: 1,  estado: 'activo',     racha_max: 2,  hitos: [], ultima_hace: 0 },
    { idx: 13, dia_actual: 5,  inicio_hace: 15, estado: 'abandonado', racha_max: 5,  hitos: [], ultima_hace: 11, racha_dias: 0 },
    { idx: 14, dia_actual: 3,  inicio_hace: 2,  estado: 'activo',     racha_max: 3,  hitos: [], ultima_hace: 0 }
  ];

  function diaFecha(dia, fechaInicio) {
    const d = new Date(fechaInicio);
    d.setDate(d.getDate() + dia - 1);
    return d;
  }

  function generarRespuesta(dia, userIdx, diaActual) {
    const nivel = diaActual >= 25 ? 'avanzado' : diaActual >= 15 ? 'intermedio' : 'principiante';
    const nombres = ['Liz', 'Carlos', 'María', 'Juan', 'Ana', 'Pedro', 'Lucía', 'Diego', 'Carla', 'José', 'Natalia', 'Ricardo', 'Sofía', 'Miguel', 'Raquel'];
    const n = nombres[userIdx % nombres.length];
    const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    // Tipos de cada paso por día (mismo mapping que mapContenidoALeccion en plan.service.js)
    // respuesta_tipo → tipo: escala→escala, accion→accion, demás→texto
    const tiposPorDia = {
      1:  ['escala','texto','texto','texto'],
      2:  ['escala','escala','escala'],
      3:  ['accion','accion','accion'],
      4:  ['accion','accion','accion','accion','accion'],
      5:  ['texto','texto','texto','texto'],
      6:  ['texto','texto','texto'],
      7:  ['accion','accion','accion','accion'],
      8:  ['texto','texto','texto','texto','texto'],
      9:  ['accion','accion','accion'],
      10: ['texto','texto','texto'],
      11: ['accion','accion','accion','accion'],
      12: ['accion','accion','accion'],
      13: ['accion','accion','accion'],
      14: ['accion','accion','accion'],
      15: ['accion','accion','accion'],
      16: ['accion','accion','accion'],
      17: ['texto','texto','texto','texto'],
      18: ['accion','accion','accion'],
      19: ['accion','accion','accion'],
      20: ['texto','texto','texto'],
      21: ['texto','texto','texto'],
      22: ['texto','texto','accion','accion'],
      23: ['accion','accion','accion'],
      24: ['accion','accion','accion'],
      25: ['escala','escala','escala','escala','accion'],
      26: ['accion','accion','accion'],
      27: ['accion','accion','accion','accion'],
      28: ['accion','accion','accion'],
      29: ['texto','texto','texto'],
      30: ['texto','texto','texto']
    };

    // Valores crudos por día
    const raw = {
      1:  [rnd(5,9), 'Sentí tensión moderada en hombros al despertar', 'Ligereza en piernas, cierta pesadez mental por el calor', 'Respiración algo superficial, mejoró tras unos minutos'],
      2:  [rnd(3,7), rnd(4,8), rnd(3,6)],
      3:  [true, true, true],
      4:  [true, true, true, true, true],
      5:  ['Generalmente entre 8 y 10 AM, antes del calor fuerte', 'Después del almuerzo, entre 2-4 PM cuando baja la energía', 'Ansiedad cuando hay presión laboral, y aburrimiento en la tarde', 'Energía más alta por la mañana (7-8/10), baja al mediodía'],
      6:  ['"No tengo disciplina para mantener una rutina"', 'La taché y escribí al lado mi nueva identidad', '"Soy una persona que elige cuidar su energía y salud cada día, incluso empezando con pasos pequeños"'],
      7:  [true, true, true, true],
      8:  ['Sí, noté menos fatiga al subir las escaleras del trabajo', 'Un poco más de concentración, aunque todavía me distraigo', 'Los brazos y piernas se sienten un poco más tonificados', 'Dormí mejor esta semana, me desperté más renovado', 'Más optimista, siento que estoy avanzando'],
      9:  [true, true, true],
      10: ['En la cena familiar del sábado, elegí una porción consciente y me sentí orgulloso al servirme lo justo', 'En el trabajo rechacé amablemente el postre de cumpleaños sin sentir culpa, fue liberador', 'Que estoy aprendiendo a decir "no" sin dureza y "sí" con gratitud'],
      11: [true, true, true, true],
      12: [true, true, true],
      13: [true, true, true],
      14: [true, true, true],
      15: [true, true, true],
      16: [true, true, true],
      17: ['Mi familia y mi salud, porque sin salud no puedo disfrutar de los míos', 'Cuidarme me permite estar presente y activo para mis hijos y nietos', 'quiero vivir con energía plena para disfrutar de mi familia y mis proyectos', 'Lo pegué en el espejo del baño, lo veo cada mañana'],
      18: [true, true, true],
      19: [true, true, true],
      20: ['Noto más energía, menos antojos compulsivos y más confianza al decidir', 'Repetí la declaración en voz alta frente al espejo, me emocionó', 'Mantendré Ashwagandha en la mañana, Cardiosmile después del almuerzo, y caminata consciente cada tarde'],
      21: ['"Otra vez fallé, no tengo voluntad para esto"', 'Te diría que un tropezón no borra el camino, que sos humano y que cada día es una nueva oportunidad', 'Me dije: ' + n + ', un día difícil no define tu proceso; mañana retomás con amor y paciencia'],
      22: ['Ayer comí de más en el almuerzo familiar, me sentí culpable y casi abandono', 'Que no necesito castigarme; puedo reconocerlo, aprender y seguir sin culpa', true, true],
      23: [true, true, true],
      24: [true, true, true],
      25: [rnd(2,6), rnd(1,5), rnd(1,5), rnd(2,5), true],
      26: [true, true, true],
      27: [true, true, true, true],
      28: [true, true, true],
      29: ['Mi compañero de oficina siempre ofrece facturas y dice que "uno no hace nada"', '"Gracias por pensar en mí, pero estoy cuidando mi salud y me hace bien. Acompañame con un café sin culpa."', 'Me visualicé firme pero amable, y después en la práctica real salió natural'],
      30: ['Autoconciencia: aprendí a escuchar mi cuerpo antes de comer. Motivación: mi porqué es mi familia', 'Ashwagandha mañana, Cardiosmile almuerzo, Omega-3 cena, caminata diaria, gratitud antes de dormir', 'Querido yo del futuro: hoy elegiste cuidarte. Nunca olvides que merecés salud y bienestar pleno. Seguí eligiéndote.']
    };

    const indices = tiposPorDia[dia] || [];
    const valores = raw[dia] || [];
    const result = [];

    for (let i = 0; i < indices.length; i++) {
      const tipo = indices[i];
      let valor = valores[i];

      if (tipo === 'escala' && typeof valor === 'number') {
        if (dia === 1 && nivel === 'principiante') valor = rnd(3, 6);
        if (dia === 5 && nivel === 'avanzado') {
          if (typeof raw[5][0] === 'number') raw[5][0] = rnd(7, 9);
          valor = i === 0 ? rnd(7, 9) : raw[5][i] || valor;
        }
      }

      result.push({ id: 'paso_' + (i + 1), valor, tipo });
    }

    return result;
  }

  for (const cfg of planesConfig) {
    const usuario = usuariosCreados[cfg.idx];
    const userDemo = usuariosDemo[cfg.idx];
    const fechaInicio = new Date(today);
    fechaInicio.setDate(fechaInicio.getDate() - cfg.inicio_hace);

    const progresoDiario = [];
    for (let d = 1; d <= 30; d++) {
      const completado = d <= cfg.dia_actual;
      progresoDiario.push({
        dia_numero: d,
        completado,
        fecha_completado: completado ? diaFecha(d, fechaInicio) : null,
        respuesta_usuario: completado ? generarRespuesta(d, cfg.idx, cfg.dia_actual) : null
      });
    }

    // Generar puntuaciones de test_inicial (5 preguntas por competencia, score 1-5)
    const testRespuestas = [];
    let preguntaNum = 0;
    const puntuacionesPorCompetencia = [];

    for (const comp of COMPETENCIA_KEYS) {
      let sumScore = 0;
      for (let r = 0; r < 5; r++) {
        preguntaNum++;
        const score = 2 + Math.floor(Math.random() * 4);
        sumScore += score;
        testRespuestas.push({
          pregunta_numero: preguntaNum,
          competencia: comp,
          score
        });
      }
      puntuacionesPorCompetencia.push({
        competencia: comp,
        competencia_label: COMPETENCIA_LABELS[comp],
        puntuacion: sumScore
      });
    }

    const competenciasMejora = puntuacionesPorCompetencia
      .filter(p => p.puntuacion < 20)
      .map(p => p.competencia_label);

    const rachaDias = cfg.racha_dias !== undefined ? cfg.racha_dias : Math.min(cfg.racha_max, cfg.dia_actual);
    const ultima = new Date(today);
    ultima.setDate(ultima.getDate() - cfg.ultima_hace);

    await PlanProgreso.create({
      usuario_id: usuario._id,
      tienda_id: userDemo.tienda._id,
      codigo_utilizado: userDemo.codigo,
      fecha_inicio: fechaInicio,
      dia_actual: cfg.dia_actual,
      racha_dias: rachaDias,
      racha_maxima: cfg.racha_max,
      hitos_alcanzados: cfg.hitos,
      ultima_fecha_actividad: ultima > today ? today : ultima,
      estado: cfg.estado,
      test_inicial: {
        fecha_completado: diaFecha(1, fechaInicio),
        respuestas: testRespuestas,
        puntuaciones_por_competencia: puntuacionesPorCompetencia,
        competencias_a_mejorar: competenciasMejora
      },
      progreso_diario: progresoDiario
    });
    console.log(`PlanProgreso creado para ${usuario.nombre} (día ${cfg.dia_actual}, ${cfg.estado})`);
  }

  // 7. Historial de Correos
  const historialData = [];

  for (let i = 0; i < usuariosCreados.length; i++) {
    const u = usuariosCreados[i];
    const cfg = planesConfig[i];
    const inicioPlan = new Date(today);
    inicioPlan.setDate(inicioPlan.getDate() - cfg.inicio_hace);

    historialData.push({
      usuario_id: u._id,
      email_destino: u.email,
      tipo_correo: 'bienvenida',
      meta: { programa: 'IEN 30 Días', tienda: usuariosDemo[i].tienda.nombre_tienda },
      fecha_envio: inicioPlan,
      estado: 'enviado'
    });

    if (cfg.hitos.length > 0) {
      const ultimoHito = cfg.hitos[cfg.hitos.length - 1];
      historialData.push({
        usuario_id: u._id,
        email_destino: u.email,
        tipo_correo: 'hito',
        meta: { dia: ultimoHito, racha: cfg.racha_max },
        fecha_envio: diaFecha(ultimoHito, inicioPlan),
        estado: 'enviado'
      });
    }
  }

  // Correos de esta semana (14-20 Julio 2026) – mucha actividad
  // Recordatorio diario: 2-3 usuarios por día de la semana
  const semana = [
    { dia: 14, usuarios: [2, 5, 8] },
    { dia: 15, usuarios: [0, 3, 6, 9] },
    { dia: 16, usuarios: [1, 4, 7, 10] },
    { dia: 17, usuarios: [2, 5, 8, 11] },
    { dia: 18, usuarios: [0, 3, 6, 9] },
    { dia: 19, usuarios: [1, 4, 7, 10, 12] },
    { dia: 20, usuarios: [0, 2, 3, 6, 8, 9, 13] }
  ];

  for (const s of semana) {
    for (const uid of s.usuarios) {
      const userCfg = planesConfig.find(p => p.idx === uid);
      if (userCfg) {
        historialData.push({
          usuario_id: usuariosCreados[uid]._id,
          email_destino: usuariosCreados[uid].email,
          tipo_correo: 'recordatorio_diario',
          meta: { dia: userCfg.dia_actual },
          fecha_envio: new Date(`2026-07-${String(s.dia).padStart(2, '0')}T10:00:00`),
          estado: 'enviado'
        });
      }
    }
  }

  // Otros tipos de correo esta semana
  historialData.push(
    { usuario_id: usuariosCreados[1]._id, email_destino: usuariosCreados[1].email, tipo_correo: 'racha_rota',             meta: { dia: 3 },  fecha_envio: new Date('2026-07-14T09:00:00'), estado: 'enviado' },
    { usuario_id: usuariosCreados[3]._id, email_destino: usuariosCreados[3].email, tipo_correo: 'racha_rota',             meta: { dia: 7 },  fecha_envio: new Date('2026-07-15T09:00:00'), estado: 'enviado' },
    { usuario_id: usuariosCreados[6]._id, email_destino: usuariosCreados[6].email, tipo_correo: 'racha_rota',             meta: { dia: 14 }, fecha_envio: new Date('2026-07-16T09:00:00'), estado: 'enviado' },
    { usuario_id: usuariosCreados[7]._id, email_destino: usuariosCreados[7].email, tipo_correo: 'urgencia_activacion',    meta: { inactivo: '3 días' }, fecha_envio: new Date('2026-07-17T11:00:00'), estado: 'enviado' },
    { usuario_id: usuariosCreados[8]._id, email_destino: usuariosCreados[8].email, tipo_correo: 'recuperacion_inactividad', meta: { inactivo: '5 días' }, fecha_envio: new Date('2026-07-18T11:00:00'), estado: 'enviado' },
    { usuario_id: usuariosCreados[4]._id, email_destino: usuariosCreados[4].email, tipo_correo: 'hito',                  meta: { dia: 15 }, fecha_envio: new Date('2026-07-19T08:00:00'), estado: 'enviado' },
    { usuario_id: usuariosCreados[5]._id, email_destino: usuariosCreados[5].email, tipo_correo: 'hito',                  meta: { dia: 15 }, fecha_envio: new Date('2026-07-17T08:00:00'), estado: 'enviado' },
    { usuario_id: usuariosCreados[9]._id, email_destino: usuariosCreados[9].email, tipo_correo: 'hito',                  meta: { dia: 25 }, fecha_envio: new Date('2026-07-14T08:00:00'), estado: 'enviado' },
    { usuario_id: usuariosCreados[10]._id, email_destino: usuariosCreados[10].email, tipo_correo: 'hito',                meta: { dia: 30 }, fecha_envio: new Date('2026-07-19T08:00:00'), estado: 'enviado' },
    { usuario_id: usuariosCreados[11]._id, email_destino: usuariosCreados[11].email, tipo_correo: 'hito',                meta: { dia: 30 }, fecha_envio: new Date('2026-07-20T08:00:00'), estado: 'enviado' },
    { usuario_id: usuariosCreados[12]._id, email_destino: usuariosCreados[12].email, tipo_correo: 'recordatorio_diario', meta: { dia: 1 },  fecha_envio: new Date('2026-07-19T10:00:00'), estado: 'enviado' },
    { usuario_id: usuariosCreados[13]._id, email_destino: usuariosCreados[13].email, tipo_correo: 'bienvenida',          meta: { programa: 'IEN 30 Días' }, fecha_envio: new Date('2026-07-20T08:00:00'), estado: 'enviado' }
  );

  await HistorialCorreo.insertMany(historialData);
  console.log(`${historialData.length} correos de historial creados`);
  }

  // 8. Contenidos diarios
  const ESCALA_LIKERT = [
    { valor: 1, etiqueta: 'Nunca' },
    { valor: 2, etiqueta: 'Raramente' },
    { valor: 3, etiqueta: 'A veces' },
    { valor: 4, etiqueta: 'Frecuentemente' },
    { valor: 5, etiqueta: 'Siempre' }
  ];

  

  const contenidosConTipo = CONTENIDOS.map(c => ({
    ...c,
    respuesta_tipo: c.datos_leccion?.ejercicio?.respuesta_tipo ?? 'abierta'
  }));

  const preguntasConLabel = TEST_PREGUNTAS.map(p => ({
    ...p,
    competencia_label: COMPETENCIA_LABELS[p.competencia],
    tipo_respuesta: 'escala',
    opciones: ESCALA_LIKERT
  }));
  await TestPregunta.insertMany(preguntasConLabel);
  console.log(`${preguntasConLabel.length} preguntas de test creadas`);

  await ContenidoDiario.insertMany(contenidosConTipo);
  console.log(`${CONTENIDOS.length} contenidos diarios creados`);

  await ContenidoEspecial.insertMany(CONTENIDOS_ESPECIALES);
  console.log(`${CONTENIDOS_ESPECIALES.length} contenidos especiales creados`);

  // Verificación de conteos
  const [countPreguntas, countEspeciales, countProductos, countCodigos, countPlanes, countUsuarios, countHistorial] = await Promise.all([
    TestPregunta.countDocuments(),
    ContenidoEspecial.countDocuments(),
    Producto.countDocuments(),
    Codigo.countDocuments(),
    PlanProgreso.countDocuments(),
    Usuario.countDocuments(),
    HistorialCorreo.countDocuments()
  ]);
  console.log('\n--- Verificación de conteos ---');
  console.log(`Usuarios = ${countUsuarios}`);
  console.log(`TestPregunta = ${countPreguntas}`);
  console.log(`ContenidoEspecial = ${countEspeciales}`);
  console.log(`Producto = ${countProductos}`);
  console.log(`Código = ${countCodigos}`);
  console.log(`PlanProgreso = ${countPlanes}`);
  console.log(`HistorialCorreo = ${countHistorial}`);

  console.log('\nSeed completado exitosamente');
  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  seed().catch((err) => {
    console.error('Error en seed:', err);
    process.exit(1);
  });
}

module.exports = { CONTENIDOS, TEST_PREGUNTAS, CONTENIDOS_ESPECIALES };







