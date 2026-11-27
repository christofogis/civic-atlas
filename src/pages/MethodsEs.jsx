import AccuracyStatus from "../components/AccuracyStatus.jsx";
import { Link } from "react-router-dom";

// Spanish version of the methods page. Keep in step with Methods.jsx: same sections, same ids.
export default function MethodsEs() {
  return (
    <main className="page prose" lang="es">
      <h1>Cómo funciona este sitio</h1>
      <p className="lede">
        Cada cifra de este sitio proviene de registros públicos oficiales, se calcula de la misma manera para
        cada miembro del Congreso y enlaza a su fuente. Esta página explica cómo.
      </p>

      <h2>Tasa de voto con el partido</h2>
      <p>
        Una <strong>votación dividida por partido</strong> es una votación nominal en la que la mayoría de los
        demócratas que votaron y la mayoría de los republicanos que votaron tomaron lados opuestos. Las votaciones
        sin una opción de sí o no, como la verificación de quórum y la elección del Presidente de la Cámara, nunca cuentan.
      </p>
      <p>
        La <strong>tasa de voto con el partido</strong> de un miembro es la proporción de sus votos de sí o no en
        votaciones divididas por partido que coincidió con la mayoría de su propio partido. Las ausencias y los votos
        "present" se excluyen. Los independientes se comparan con el partido con el que se agrupan, según el conjunto
        de datos congress-legislators.
      </p>
      <p>
        Solo se usan las votaciones divididas por partido porque la mayoría de las votaciones del Congreso no se
        disputan por partido; contar todas haría que casi todos los miembros parecieran iguales. Esto sigue el método
        de "unidad partidaria" que los investigadores del Congreso usan desde hace mucho tiempo.
      </p>
      <p>
        Una tasa alta o baja no es un juicio. Describe con qué frecuencia los votos de un miembro coincidieron con la
        mayoría de su partido, nada más. La tasa no se muestra con menos de 20 votaciones divididas por partido.
      </p>

      <h2>Tasa de votos no emitidos</h2>
      <p>
        La proporción de votaciones nominales de la cámara del miembro, durante su servicio, en las que el secretario
        lo registró como "Not Voting" (no votó). Las ausencias pueden tener muchas causas, como enfermedad, asuntos
        familiares o campañas; los registros no dicen cuál.
      </p>

      <h2>Medianas de la cámara</h2>
      <p>
        Se muestran como contexto: la mitad de los miembros de la cámara está por encima de la mediana y la mitad por
        debajo. Se excluyen los miembros con menos de 50 votaciones en un Congreso. Los delegados y el Comisionado
        Residente solo pueden votar en ciertas votaciones de enmiendas, así que sus cifras no se comparan con la cámara.
      </p>

      <h2 id="cosponsorship">Trabajo entre partidos</h2>
      <p>
        Copatrocinar un proyecto es una declaración pública de apoyo, y los miembros a menudo copatrocinan proyectos
        del otro partido. Se muestran dos cifras por Congreso:
      </p>
      <ul className="plain">
        <li><strong>Copatrocinio entre partidos:</strong> de los proyectos que un miembro copatrocinó, la proporción presentada por un miembro del otro partido.</li>
        <li><strong>Apoyo entre partidos:</strong> de los proyectos que un miembro presentó, la proporción que obtuvo al menos un copatrocinador del otro partido.</li>
      </ul>
      <p>
        El partido se toma a la fecha en que se presentó el proyecto (para el patrocinador) o en que se copatrocinó
        (para el copatrocinador); los independientes cuentan con el partido con el que se agrupan. Los copatrocinios
        retirados no cuentan. Las tasas no se muestran con menos de 20 proyectos copatrocinados o 10 presentados.
        El copatrocinio refleja apoyo a la presentación de un proyecto, no cómo vota el miembro después.
      </p>

      <h2 id="vote-types">Tipos de votación</h2>
      <p>
        Muchas votaciones tratan sobre el procedimiento y no sobre un proyecto en sí, y un "no" en una votación de
        procedimiento no es un "no" al proyecto. Cada votación se clasifica según la redacción del propio secretario:
      </p>
      <ul className="plain">
        <li><strong>Aprobación final:</strong> si aprobar un proyecto o una resolución, o aceptar la versión de la otra cámara. "Dos tercios" indica votaciones de la Cámara con reglas abreviadas, que requieren dos tercios para aprobarse.</li>
        <li><strong>Anulación del veto:</strong> si aprobar un proyecto a pesar del veto del Presidente. Requiere dos tercios.</li>
        <li><strong>Confirmación:</strong> si el Senado confirma a una persona nominada.</li>
        <li><strong>Cloture:</strong> si el Senado termina el debate. Requiere 60 votos para la mayoría de los proyectos y mayoría simple para nominaciones.</li>
        <li><strong>Enmienda:</strong> si cambiar el texto de un proyecto.</li>
        <li><strong>De procedimiento:</strong> cómo procede la cámara, por ejemplo considerar un proyecto, dejarlo de lado (aplazarlo), devolverlo al comité, dejar sin efecto una regla presupuestaria o adoptar una "regla" de la Cámara que fija las condiciones del debate de otro proyecto.</li>
      </ul>
      <p>"Solo votos finales" en la página de un miembro muestra aprobaciones finales, anulaciones de veto y confirmaciones.</p>
      <p>
        Junto a cada voto registrado, una frase breve dice qué significó ese voto en ese tipo de votación, por
        ejemplo "Nay · en contra de terminar el debate" o "Yea · devolverlo al comité". Describe solo el
        procedimiento, según el tipo de votación; nunca lo que la votación habría hecho ni por qué un miembro votó así.
      </p>

      <h2 id="vote-sentences">Lo que decidió una votación, en una frase</h2>
      <p>
        Cada votación empieza con una frase, por ejemplo "Votar Sí significaba aprobar H.R. 1. Se aprobó,
        218–214, así que pasa al Senado." Se llena una plantilla fija para ese tipo de votación, usando solo la
        pregunta oficial del secretario, el resultado oficial y el número de la medida; no la escribe una IA y
        no describe el contenido ni los efectos del proyecto. Todas las votaciones del mismo tipo reciben la
        misma redacción, sin importar quién votó.
      </p>
      <p>
        Un umbral de votos se menciona solo cuando lo fijan las reglas (dos tercios para suspender las reglas o
        anular un veto, 60 votos para el cloture sobre legislación, mayoría simple para el cloture sobre
        nominaciones) o cuando lo indica el propio resultado del Senado. "Lo que sigue" se menciona solo cuando
        el tipo de medida lo determina, como un proyecto de la Cámara que pasa al Senado después de que la
        Cámara lo aprueba. Si una pregunta no es de un tipo reconocido, la frase solo da la pregunta y el
        resultado oficiales. La redacción del propio secretario siempre aparece debajo, con enlace a la votación.
      </p>

      <h2 id="vote-issues">Votos por tema</h2>
      <p>
        Cada proyecto recibe un área de política de la Biblioteca del Congreso (por ejemplo, "Salud" o "Inmigración"),
        elegida por sus analistas legislativos. Una votación toma el área de política del proyecto votado, incluidas las
        votaciones sobre enmiendas, mociones de procedimiento y reglas para ese proyecto, así que la etiqueta del tipo
        de votación importa al leerlas. Un proyecto amplio, como un presupuesto o un paquete grande, recibe igualmente una
        sola área de política, así que sus votaciones aparecen solo bajo ese tema. Una "regla" de la Cámara que fija las
        condiciones del debate de un proyecto es una resolución aparte con su propia área de política, normalmente "Congreso".
      </p>
      <p>
        Las votaciones sobre nominaciones se agrupan como "Nominaciones". Las votaciones sin proyecto ni persona nominada,
        como la elección del Presidente de la Cámara o mociones sobre el procedimiento, se agrupan como "Otras votaciones".
      </p>

      <h2 id="issues">Los temas que le importan</h2>
      <p>
        La página de temas usa nombres cotidianos, como "Empleo y salarios", para las áreas de política de la
        Biblioteca del Congreso descritas arriba. Cada nombre corresponde a una o dos áreas oficiales (por ejemplo,
        "Medio ambiente y energía" incluye "Protección ambiental" y "Energía"), y la página muestra cuáles bajo cada
        tema. Las áreas sin nombre cotidiano aparecen en "Más temas" con sus nombres oficiales. Los nombres describen
        solo un asunto; no dicen lo que haría un proyecto sobre él.
      </p>
      <p>
        Las cifras de una línea vienen de los registros oficiales, de los últimos 30 días. Un proyecto cuenta como
        que avanzó si en esos días ocurrió un paso de su trámite: informado por un comité, una votación en la Cámara
        o el Senado (aprobado o rechazado), enviado al Presidente, firmado como ley o vetado. Su presentación no
        cuenta. Las votaciones nominales son votos registrados sobre proyectos de esas áreas, como se describe arriba.
        Los proyectos a los que la Biblioteca del Congreso aún no asigna un área no están en ningún tema. Si buscó su
        dirección en este dispositivo, cada votación muestra también cómo votaron sus miembros del Congreso, tal como
        lo registró el secretario. Sus temas elegidos se guardan solo en su dispositivo.
      </p>

      <h2 id="text-versions">Qué cambió entre versiones de un proyecto</h2>
      <p>
        Cada vez que un proyecto avanza un paso, la Oficina de Publicaciones del Gobierno imprime una nueva versión oficial.
        Para cada versión, comparamos su texto completo con el de la versión anterior, sección por sección. Una sección se
        empareja por su título dentro de su título mayor; cuando se cambia el nombre de un título mayor, las secciones cuyo
        título aparece una sola vez en cada versión se siguen emparejando. Una sección cuenta como modificada cuando
        cualquiera de sus palabras cambia (se ignoran los espacios y el estilo de las comillas), así que una corrección de una
        palabra y una reescritura completa cuentan igual, como una sección modificada. Los números de sección se excluyen,
        porque renumerar no cambia nada. Una sección con nuevo título cuenta como una eliminada y una agregada. El texto que se
        cita para insertarlo en leyes existentes pertenece a la sección que lo cita. El texto que un comité tachó se excluye,
        porque ya no forma parte del proyecto.
      </p>
      <p>
        Una "engrossed amendment" solo enumera los cambios que hizo la segunda cámara, así que se muestra pero no se compara;
        la versión final ("enrolled") se compara con la versión anterior a la enmienda. La comparación se calcula, nadie la
        redacta, y dice dónde cambió el texto, no qué efecto tiene un cambio.
      </p>

      <h2 id="record">El historial de un miembro por fecha</h2>
      <p>
        "Historial por fecha" en la página de cada miembro muestra, del más reciente al más antiguo: las votaciones
        nominales con la posición registrada del miembro y la redacción del secretario sobre la pregunta y el resultado;
        los proyectos que presentó; sus proyectos que se convirtieron en ley; y las operaciones bursátiles que declaró,
        con la fecha de la declaración. "Hechos principales" muestra los votos de aprobación final y de confirmación;
        "Todas las votaciones" agrega enmiendas y votos de procedimiento. El historial de cada miembro usa las mismas
        entradas con las mismas palabras, y cada una enlaza a su fuente.
      </p>

      <h2 id="bill-parts">Todas las partes de un proyecto</h2>
      <p>
        La página de un proyecto muestra cada título y sección de su texto oficial más reciente de GovInfo, en orden,
        con el encabezado propio de cada sección y su extensión en palabras, y abre el texto de cualquier sección en el
        mismo lugar. La búsqueda muestra qué secciones mencionan una palabra. Los encabezados y el texto son los del
        proyecto, en inglés. El texto de una ley pública se lee del proyecto aprobado por ambas cámaras, que tiene
        las mismas palabras.
      </p>

      <h2 id="section-summaries">Resúmenes de secciones hechos por IA</h2>
      <p>
        Algunas secciones tienen un resumen breve en lenguaje sencillo, marcado como "Resumen generado por IA", con el
        texto oficial de la sección a un toque. El texto es el registro; el resumen es una ayuda para leerlo. El
        resumen del Servicio de Investigación del Congreso, cuando existe, sigue arriba en la página del proyecto.
      </p>
      <p>
        Los resúmenes se escriben de antemano con el modelo Claude Haiku de Anthropic, solo a partir del texto de la
        sección y con las mismas instrucciones escritas para todos los proyectos: decir qué hace la sección, quién debe
        o puede hacer qué, y los montos y fechas tal como están impresos; no agregar antecedentes; nunca describir el
        propósito, el efecto ni quién gana o pierde, salvo que el texto lo diga; no usar palabras que juzguen. Luego
        una segunda consulta compara cada resumen con el texto y enumera toda afirmación que el texto no respalde. Un
        resumen señalado se reescribe una vez indicando esos problemas y se vuelve a verificar; si sigue fallando, no
        se muestra. No se resumen las secciones de menos de 40 palabras ni los índices. Cada resumen corresponde a una
        versión del texto, así que una versión nueva recibe resúmenes nuevos. Los resúmenes en español se escriben
        junto con los de inglés y se verifican contra ellos.
      </p>

      <h2 id="bill-stage">En qué etapa está un proyecto</h2>
      <p>
        Las etapas en la parte superior de la página de un proyecto se construyen a partir de la lista oficial de acciones
        del proyecto en GovInfo Bill Status. Cada etapa es la primera fecha en que aparece su código de acción de la
        Biblioteca del Congreso: presentado; informado por un comité (5000 o 14000); aprobado o adoptado por la Cámara
        (8000) o rechazado allí (9000); lo mismo en el Senado (17000, 18000); presentado al Presidente (28000); vetado
        (31000); convertido en ley (36000, solo cuando la acción dice que se convirtió en ley pública o privada, no solo que
        fue firmado). La etapa del comité también muestra la fecha en que el proyecto fue remitido, según su lista de comités.
      </p>
      <p>
        Las etapas dependen del tipo de medida. Una resolución simple (H.Res., S.Res.) solo necesita su propia cámara. Una
        resolución concurrente necesita ambas cámaras y no se envía al Presidente. Una resolución conjunta cuyo título
        oficial propone una enmienda a la Constitución pasa a los estados después de que ambas cámaras la aprueban; la
        ratificación estatal no está en los registros que usamos, así que esa etapa no tiene fecha. Los proyectos de ley y
        las demás resoluciones conjuntas se envían al Presidente.
      </p>
      <p>
        No se completa nada por suposición. Cuando una etapa posterior está en el registro pero falta la fecha de una
        anterior, la anterior dice "Fecha no registrada". Cuando un proyecto avanzó sin un informe de comité en el registro
        (un comité puede ser relevado u omitido), la etapa del comité lo indica. Una votación nominal se enlaza a una etapa
        solo cuando hay exactamente una votación de aprobación en esa cámara ese día; muchos proyectos se aprueban a viva
        voz, sin votación nominal. La frase "Siguiente paso" nombra la cámara que actuaría después, y dice que hay una
        votación programada solo cuando la agenda del pleno de la Cámara o una sesión de enmiendas de un comité incluye el
        proyecto. Para un proyecto de un Congreso anterior que no se convirtió en ley, la página dice que el Congreso terminó
        sin que se convirtiera en ley: los proyectos que no se aprueban antes del fin de un Congreso tendrían que presentarse
        de nuevo. La sección "Pasos y acciones" muestra cada fecha registrada con su código de acción y enlaza a la lista
        completa de acciones en Congress.gov.
      </p>

      <h2 id="photos">Fotos</h2>
      <p>
        Los miembros del Congreso aparecen con su retrato oficial, de la colección de dominio público que mantiene el
        proyecto unitedstates. Los funcionarios estatales aparecen con la foto oficial que enlaza Open States, cargada
        desde el sitio de la legislatura o de la oficina. Cuando una fuente no tiene foto, no se muestra ninguna. Los
        funcionarios de condados y ciudades aparecen sin foto en todas partes, porque ninguna fuente las reúne para
        todos los lugares.
      </p>

      <h2 id="on-the-ballot">En la boleta</h2>
      <p>
        La página En la boleta muestra los escaños de cada boleta de elección general y quién los ocupa ahora. Se calcula a
        partir de las fechas de fin de los períodos, no de quién se presenta: un escaño está en la boleta de un año cuando el
        período de su titular termina después del 3 de enero del año anterior y a más tardar el 3 de enero posterior a la
        elección de ese año. Así también se incluye a un senador designado hasta una elección especial. Los escaños de la
        Cámara de la próxima elección aparecen cuando asumen los miembros elegidos antes. Los ciclos de California (cargos
        estatales en los años de elección de gobernador, y los distritos pares e impares del Senado estatal en elecciones
        alternas) siguen la constitución del estado; los del Condado de Orange provienen de las fechas de los períodos de
        cada funcionario. Después de una elección, cuando comienzan los nuevos períodos y aparecen en la lista oficial de
        miembros, cada escaño indica si quien lo ocupaba regresó y, en el Senado, quién lo ocupa ahora. En la Cámara solo
        se indica si el miembro regresó, porque los distritos pueden cambiar entre un Congreso y otro. El sitio no dice
        que alguien perdió: puede que no se haya presentado. Los retratos que faltan se muestran como una silueta gris.
        Los candidatos inscritos están en la página de candidatos de 2028.
      </p>

      <h2 id="ca-results">Resultados electorales de California</h2>
      <p>
        Los resultados de la elección general del 3 de noviembre de 2026 en California provienen de la Secretaría de
        Estado de California. Mientras los condados cuentan las boletas, son los resultados semioficiales que la
        Secretaría publica en electionresults.sos.ca.gov, leídos dos veces al día de la misma fuente pública de datos que
        usa ese sitio. Esas cifras cambian a medida que continúa el conteo, por lo que cada resultado indica cuándo la
        Secretaría lo actualizó por última vez. Los condados terminan su escrutinio oficial a más tardar el 3 de
        diciembre, y la Secretaría certifica los resultados el 11 de diciembre de 2026 en la Declaración del Voto
        (Statement of Vote). Cuando se publican las hojas de cálculo de la Declaración del Voto y abarcan todas las
        contiendas, el sitio suma los totales de los condados, los muestra en lugar de las cifras semioficiales e indica
        que los resultados están certificados.
      </p>
      <p>
        Se incluyen los ocho cargos estatales, los cuatro distritos de la Junta de Igualación, las medidas estatales y los
        52 distritos de California en la Cámara de EE. UU. (ningún escaño de California en el Senado de EE. UU. estuvo en
        la boleta de 2026). Los nombres de los candidatos, el partido y los títulos de las medidas se muestran tal como
        los publica la Secretaría de Estado, en inglés. Civic Atlas no declara ganadores; muestra los votos y el
        porcentaje de cada candidato. California usó mapas congresionales nuevos en 2026, por lo que la página de un
        miembro muestra una contienda de 2026 solo cuando el nombre impreso en la boleta coincide con el nombre del
        miembro (sin tener en cuenta mayúsculas ni puntuación), nunca solo por el número de distrito.
      </p>

      <h2 id="election-results">Resultados electorales</h2>
      <p>
        Las páginas de los miembros muestran cada elección general en la que el miembro fue candidato(a), y la página En la
        boleta muestra la proporción de votos de quien ocupa cada escaño, según resultados oficiales certificados. La fuente
        principal es la publicación Federal Elections de la FEC, que recopila los resultados certificados de cada estado para
        el Senado y la Cámara, incluidas las elecciones especiales, las segundas vueltas y las rondas de voto preferencial. La
        FEC la publica mucho después de la elección (Federal Elections 2022 apareció en 2025). Para un año que la FEC aún no
        ha publicado, los resultados provienen de las estadísticas de la elección presidencial y del Congreso de la Secretaría
        de la Cámara (Statistics of the Presidential and Congressional Election), publicadas unos meses después de la
        elección; 2024 proviene por ahora de la Secretaría. Un proceso mensual busca publicaciones nuevas y cambia un año al
        archivo de la FEC cuando aparece.
      </p>
      <p>
        Los nombres y partidos se muestran tal como aparecen: la FEC imprime "Apellido, Nombre" y códigos de partido (D, R,
        LIB, W para votos por escrito), y la Secretaría imprime nombres completos y nombres de partido. En Nueva York,
        Connecticut y otros estados donde un candidato puede presentarse en más de una línea de partido, se muestra cada
        línea y el total es el voto combinado del candidato. En el archivo de la FEC, el porcentaje es el publicado: la
        proporción de todos los votos emitidos en la contienda. La Secretaría solo publica votos, así que para esos años el
        porcentaje se calcula aquí, como los votos del candidato sobre todos los votos publicados para la contienda, sin
        contar los votos en blanco, nulos, de más ni de menos. Algunos estados no imprimen en la boleta a los candidatos sin
        oposición, por lo que no hay recuento de votos para ellos. El sitio no marca ganadores ni márgenes: la página En la
        boleta indica quién ocupó cada escaño después, según la lista oficial de miembros.
      </p>
      <p>
        Los miembros se asocian a los candidatos por su número de candidato de la FEC, el mismo que tienen los datos de los
        miembros. El archivo de la FEC da un número para cada candidato. Para los años de la Secretaría, los números provienen
        de la lista de la FEC de candidatos al Congreso en las boletas de la elección general, asociados dentro de la misma
        contienda por apellido (y nombre, o una diferencia de ortografía de una o dos letras). Cuando una fuente da un mismo
        número a dos candidatos de una contienda, el número queda solo con el candidato que es el miembro del Congreso al que
        pertenece; si no, se descarta, y esa contienda puede no aparecer en la página de ese miembro.
      </p>

      <h2 id="hearings">Audiencias y reuniones de comités</h2>
      <p>
        Las audiencias, sesiones de enmiendas y reuniones de trabajo de ambas cámaras provienen de los registros de
        reuniones de comités de Congress.gov, desde 2023, actualizados a diario: fecha, comité, lugar, video, documentos y
        los proyectos y nominaciones en la agenda. Las listas de testigos y los testimonios escritos aparecen solo en las
        audiencias de la Cámara. Los comités de la Cámara los presentan en el registro central; los comités del Senado los
        publican en sus propios sitios web, así que las páginas de audiencias del Senado enlazan allí. Los proyectos de una
        reunión son los que indica el registro, que puede no incluir todos los que se trataron.
      </p>

      <h2 id="map">El mapa</h2>
      <p>
        Las líneas de los distritos provienen de la Oficina del Censo: su archivo cartográfico de límites para el
        Congreso actual y sus archivos TIGER/Line de 2026 para el siguiente, recortados a la costa. Las líneas se
        simplifican para que el mapa cargue rápido, así que cerca de un límite el mapa puede diferir por una cuadra o
        algo así; la búsqueda por dirección usa las líneas exactas. Todos los distritos se dibujan del mismo color; el
        partido aparece solo junto a los nombres. El mapa de calles es de OpenFreeMap, basado en datos de
        OpenStreetMap; no necesita cuenta y no le enviamos nada sobre usted, aunque, como cualquier sitio web, recibe
        las solicitudes de las imágenes del mapa que muestra su navegador.
      </p>
      <p>
        Las cifras de cada distrito (población, edad mediana, ingreso del hogar, valor de la vivienda, educación y
        pobreza) son las estimaciones de 5 años de la Encuesta sobre la Comunidad Estadounidense de la Oficina del Censo.
        Son estimaciones de encuesta, así que cada una tiene un margen de error, y describen los años encuestados, no el
        presente. Los condados muestran cuántos residentes del distrito viven en cada uno. Las ciudades y pueblos se
        incluyen cuando su punto central está dentro del distrito; un distrito que queda dentro de una ciudad grande
        (como la mayor parte de Manhattan) muestra en cambio la ciudad que cubre la mayor parte de su territorio, marcada
        como parte. La Oficina del Censo aún no ha publicado cifras para las nuevas líneas de los estados que
        redibujaron sus distritos, así que esos distritos todavía no muestran ninguna.
      </p>

      <h2 id="accuracy">Cómo verificamos la exactitud</h2>
      <p>
        Cada semana, un programa elige datos al azar de este sitio (cómo votaron los miembros, quién patrocinó y copatrocinó
        proyectos, números de ley, ingresos de campaña) y compara cada uno con el registro original del Secretario de la Cámara,
        el Senado, GovInfo y la FEC. Toda diferencia se investiga, y los errores que encontramos se listan en la página de
        correcciones.
      </p>
      <AccuracyStatus />

      <h2 id="compare">Comparar dos miembros</h2>
      <p>
        La comparación cuenta las votaciones en que ambos miembros votaron Yea o Nay (Guilty o Not Guilty en juicios
        políticos) e informa con qué frecuencia coincidieron. Cuenta todo tipo de votación, incluidas las de procedimiento
        y las enmiendas, así que la cifra describe todos los votos registrados y no solo las aprobaciones finales. Se excluyen
        las votaciones en que alguno estuvo ausente o votó Present. Solo se pueden comparar miembros de la misma cámara,
        porque cada cámara vota por separado.
      </p>

      <h2 id="money">Finanzas de campaña</h2>
      <p>
        Los totales provienen de los informes de cada campaña a la Comisión Federal de Elecciones (FEC), por ciclo de dos
        años. Para el ciclo más reciente, la página de un miembro también muestra:
      </p>
      <ul className="plain">
        <li><strong>Dónde viven los donantes detallados:</strong> contribuciones detalladas de personas, separadas por el estado de la dirección del donante (totales por estado de la FEC). Solo se detallan los donantes que dan más de $200 en el ciclo, así que las donaciones pequeñas no se incluyen, y la dirección es donde vive el donante, no donde trabaja. Las direcciones militares y del extranjero cuentan como fuera del estado del miembro.</li>
        <li><strong>Contribuciones por monto:</strong> dinero de personas, agrupado según el monto de cada donación. Las donaciones de menos de $200 no tienen que detallarse, así que se muestran como un solo total.</li>
        <li><strong>Empleadores de los donantes:</strong> los empleadores que las personas donantes escribieron en sus formularios, ordenados por total. Las empresas no pueden contribuir directamente a campañas federales; estas son donaciones de personas. Las entradas que no nombran un empleador (Retired, Self-employed, Not employed, Homemaker, Student, Information requested, N/A y vacías) se excluyen de la lista.</li>
        <li><strong>PAC y otros comités:</strong> contribuciones informadas como provenientes de otros comités políticos, ordenadas por total entre las 100 contribuciones de ese tipo más grandes de la campaña. No se incluyen las transferencias entre los propios comités de un candidato. Los límites federales mantienen las donaciones de cada comité en unos pocos miles de dólares por elección.</li>
        <li><strong>Gasto externo:</strong> dinero que gastan grupos como los super PAC para apoyar al candidato u oponerse a él sin coordinar con la campaña, según lo informado a la FEC.</li>
      </ul>
      <p>Aquí no se nombra a ningún donante individual, y las reglas de la FEC prohíben usar los nombres de donantes para pedir contribuciones o con fines comerciales.</p>

      <h2 id="budget">Presupuesto federal</h2>
      <p>
        La página del presupuesto usa el Estado Mensual del Tesoro, Tabla 9 ("Resumen de ingresos por fuente y gastos por
        función"). Las cifras de cada año fiscal son los totales acumulados del estado de septiembre; el año en curso muestra
        el mes más reciente. Los gastos son el dinero realmente pagado, que difiere de lo que el Congreso asigna en un año dado.
        Las categorías y sus nombres son del Tesoro; algunas, como los ingresos compensatorios no distribuidos, se registran
        como montos negativos y reducen el total. "De cada $100" divide cada categoría entre el gasto total (o los ingresos).
        La gráfica año por año agrupa el gasto en las seis funciones más grandes en la mayoría de los años desde 2015
        (Seguro Social, Medicare, salud, intereses netos, seguridad de ingresos, defensa nacional) y todo lo demás, que es el
        gasto total menos esas seis. Su línea marca los ingresos totales.
      </p>
      <p>
        Las cifras de deuda vienen de Debt to the Penny: la deuda pública total, dividida en deuda en manos del público y
        tenencias intragubernamentales, el último día hábil de cada año fiscal y el día más reciente publicado. Ambos
        conjuntos de datos vienen de la API Fiscal Data de la Oficina del Servicio Fiscal y se reconstruyen cada mes, después
        de que se publica el estado.
      </p>
      <p>
        El superávit o déficit desde 1940 viene de las Tablas Históricas de la Oficina de Administración y Presupuesto (OMB),
        Tabla 1.3: ingresos, gastos y superávit o déficit en dólares de cada año, en dólares ajustados por inflación y como
        parte del producto interno bruto, tal como los publica la OMB. Solo se usan años reales; se omiten las estimaciones de
        la tabla para años posteriores. La OMB actualiza las tablas con cada presupuesto del presidente, así que su último año
        real puede ir detrás de las cifras del Tesoro de arriba.
      </p>
      <p>
        Debajo de esa gráfica, tres filas muestran quién era presidente y qué partido tenía la mayoría en el Senado y en la
        Cámara, en la misma escala de años fiscales. Las fechas de los presidentes vienen de la Casa Blanca; las mayorías, de
        las tablas de división partidista del Senado y del Historiador de la Cámara, tal como se organizó cada cámara,
        contando a los independientes con el partido con el que se agrupaban. Todos los partidos se dibujan igual. Las filas
        dan contexto sobre las fechas; no son una conclusión sobre quién causó un déficit.
      </p>
      <h2 id="lobbying">Cabildeo sobre proyectos</h2>
      <p>
        Según la Ley de Divulgación de Cabildeo, las firmas de cabildeo y las organizaciones que hacen cabildeo para sí mismas
        presentan un informe cada trimestre por cada cliente. El informe enumera los temas sobre los que hicieron cabildeo,
        a menudo nombrando proyectos por número. Las páginas de proyectos listan los clientes cuyos informes mencionan ese
        proyecto, las firmas que hicieron el cabildeo y los trimestres en que se informó.
      </p>
      <p>
        Los números de proyecto se leen del texto del informe (por ejemplo, "H.R. 4791" o "S.1462"). Cada número se empareja
        con el Congreso en funciones en el año del informe, y solo se conservan los proyectos que este sitio sigue. Un informe
        que nombra un proyecto solo por su título, sin número, no se cuenta. Cuando un informe se enmienda, solo se usa la
        versión más reciente.
      </p>
      <p>
        Un informe menciona el proyecto; no dice si el cliente lo apoyaba o se oponía, ni qué pidió. Los informes declaran
        ingresos o gastos para todo el informe, que abarca todos sus temas, así que este sitio no atribuye montos a proyectos
        individuales. Cada entrada enlaza al informe.
      </p>
      <p>
        Cada informe también enumera a los cabilderos que trabajaron en cada tema y cualquier cargo "cubierto" en el poder
        ejecutivo o legislativo que cada uno haya ocupado en los últimos 20 años. Las páginas de proyectos listan a esos
        cabilderos y sus cargos tal como se presentaron, para los temas que mencionan el proyecto. La redacción varía según
        quién presenta el informe, y algunas entradas no describen un cargo público; no las editamos ni emparejamos nombres
        con miembros del Congreso.
      </p>
      <p>
        Fuente: LDA.gov, administrado por el Secretario del Senado y el Secretario de la Cámara. La Oficina de Registros
        Públicos del Senado no puede garantizar los datos ni los análisis derivados de estos informes después de obtenerlos.
      </p>

      <h2 id="trades">Compraventa de acciones</h2>
      <p>
        Según la Ley STOCK, los miembros del Congreso deben informar cada compra, venta o intercambio de acciones, bonos y
        activos similares de más de $1,000 hechos por ellos, su cónyuge o sus hijos dependientes, dentro de los 30 días de
        enterarse y a más tardar 45 días después de la transacción. Estos informes se llaman Informes Periódicos de
        Transacciones (PTR).
      </p>
      <p>
        Las transacciones se muestran tal como se presentaron: el nombre del activo, el monto en el rango que exige la ley
        (las cifras exactas no se divulgan) y quién era el titular. "Días hasta el informe" cuenta desde la fecha de la
        transacción hasta la fecha en que se presentó el informe; se señala cuando son más de 45, porque ese es el límite
        de la ley. Los registros no muestran si se pagó o se perdonó una multa por demora. Cuando un informe indica una
        fecha de transacción posterior a su propia fecha de presentación, las fechas se muestran tal como se presentaron y
        no se cuentan en ningún sentido.
      </p>
      <p>
        Los informes enmendados a menudo repiten transacciones de un informe anterior. Cada transacción se muestra una vez,
        desde el primer informe que la incluyó. Las transacciones que aparecen por primera vez en un informe enmendado nunca
        se cuentan como informadas después de 45 días, porque la fecha de una enmienda puede reflejar una corrección y no
        cuándo se divulgó la transacción. Los informes presentados en papel se enlazan pero no se detallan. La cobertura
        empieza en enero de 2025.
      </p>
      <p>
        Por ley (5 U.S.C. § 13107), estos informes no pueden usarse con fines comerciales, salvo por medios de comunicación
        para informar al público, ni para determinar la calificación crediticia de alguien, ni para pedir dinero.
      </p>

      <h2 id="local-agendas">Agendas del Condado de Orange y "Su semana"</h2>
      <p>
        La agenda de la Junta de Supervisores se lee dos veces al día del sistema de agendas de la Secretaría de la Junta.
        Cada asunto se muestra como fue publicado, en inglés: su número, departamento, descripción, los distritos que
        menciona, cualquier cambio que anotó la Secretaría (aplazado, eliminado, título revisado) y un enlace a su informe
        y documentos. No se resume nada. "Mencionan su distrito" cuenta los asuntos que nombran su distrito de supervisor
        por número; los asuntos para todos los distritos se cuentan aparte.
      </p>
      <p>
        Lo que hizo la Junta viene del acta resumida de acciones de la Secretaría de las reuniones ordinarias y especiales
        recientes: cada asunto, cada moción tal como se imprimió y las líneas de votación (a favor, en contra, abstenciones,
        ausentes, excusados) tal como se registraron. Los conteos de votos de los supervisores suman esas líneas; un
        supervisor se cuenta solo donde el acta lo nombra, así que una moción que menciona solo a parte de la Junta cuenta
        solo a los nombrados. La tarjeta de cada supervisor muestra sus conteos, los asuntos de cada voto distinto de a
        favor y cuántas mociones mencionan solo a parte de la Junta sin nombrarlo. Algunas acciones, a menudo informes de
        sesiones a puerta cerrada, describen una votación en una oración ("on a vote of 3 to 2, with ... voting yes") en
        lugar de líneas de votación. Se muestran tal como se imprimieron y aparecen en la tarjeta de cada supervisor, pero
        no se cuentan, porque contarlas significaría sacar nombres de una oración.
      </p>
      <p>
        "Su semana" muestra lo que viene para los funcionarios de la dirección que buscó, con los mismos tipos de asuntos
        y la misma redacción para todos: audiencias de los comités en que están sus miembros del Congreso, la agenda del
        pleno de la Cámara, fechas estatales y del condado, y reuniones del concejo municipal. Se arma con los números de
        distrito guardados en su dispositivo o incluidos en el enlace de la página, nunca con una dirección. El archivo de
        calendario se crea en su navegador.
      </p>

      <h2>De dónde vienen los datos</h2>
      <ul className="plain">
        <li><strong>Miembros, períodos, comités:</strong> el conjunto de datos de dominio público congress-legislators.</li>
        <li><strong>Votaciones nominales:</strong> el Secretario de la Cámara y Senate.gov, registradas tal como se publicaron.</li>
        <li><strong>Proyectos, copatrocinadores, resúmenes:</strong> registros GovInfo Bill Status de la Biblioteca del Congreso. Los resúmenes los escribe el Servicio de Investigación del Congreso, que es apartidista, y se publican en inglés.</li>
        <li><strong>Compraventa de acciones:</strong> Informes Periódicos de Transacciones del Secretario de la Cámara y del sistema electrónico de divulgación financiera del Senado.</li>
        <li><strong>Finanzas de campaña:</strong> la Comisión Federal de Elecciones, totales por ciclo de dos años.</li>
        <li><strong>Resultados electorales:</strong> las publicaciones Federal Elections de la FEC con resultados certificados, o las estadísticas electorales de la Secretaría de la Cámara hasta que la FEC publique un año (<a href="#election-results">detalles</a>).</li>
        <li><strong>Su distrito:</strong> Geocodio, con los límites de distritos de la Oficina del Censo. Su dirección se usa solo para la búsqueda y nunca la guardamos. Cuando las sugerencias de dirección están activas, lo que escribe en la casilla de dirección se envía a Google Places para sugerir direcciones.</li>
        <li><strong>Visitas:</strong> Cloudflare Web Analytics cuenta páginas vistas y visitas sin cookies y sin recopilar datos personales, así que no puede saber quién es usted ni si ya visitó el sitio antes.</li>
      </ul>
      <p>
        Los datos se actualizan automáticamente cada día (las finanzas de campaña, cada semana), y cada sección de la página
        de un miembro indica cuándo se actualizó. La cobertura empieza con el 118.º Congreso (enero de 2023).
      </p>

      <h2>Correcciones</h2>
      <p>
        Si algo aquí está mal, se corregirá y la corrección se anotará en el <Link to="/corrections">registro público de correcciones</Link>.
      </p>
    </main>
  );
}
