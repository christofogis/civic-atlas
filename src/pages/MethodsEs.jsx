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

      <h2 id="hearings">Audiencias y reuniones de comités</h2>
      <p>
        Las audiencias, sesiones de enmiendas y reuniones de trabajo de ambas cámaras provienen de los registros de
        reuniones de comités de Congress.gov, desde 2023, actualizados a diario: fecha, comité, lugar, video, documentos y
        los proyectos y nominaciones en la agenda. Las listas de testigos y los testimonios escritos aparecen solo en las
        audiencias de la Cámara. Los comités de la Cámara los presentan en el registro central; los comités del Senado los
        publican en sus propios sitios web, así que las páginas de audiencias del Senado enlazan allí. Los proyectos de una
        reunión son los que indica el registro, que puede no incluir todos los que se trataron.
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
        <li><strong>Contribuciones por monto:</strong> dinero de personas, agrupado según el monto de cada donación. Las donaciones de menos de $200 no tienen que detallarse, así que se muestran como un solo total.</li>
        <li><strong>Empleadores de los donantes:</strong> los empleadores que las personas donantes escribieron en sus formularios, ordenados por total. Las empresas no pueden contribuir directamente a campañas federales; estas son donaciones de personas. Las entradas que no nombran un empleador (Retired, Self-employed, Not employed, Homemaker, Student, Information requested, N/A y vacías) se excluyen de la lista.</li>
        <li><strong>PAC y otros comités:</strong> contribuciones informadas como provenientes de otros comités políticos, ordenadas por total entre las 100 contribuciones de ese tipo más grandes de la campaña. No se incluyen las transferencias entre los propios comités de un candidato. Los límites federales mantienen las donaciones de cada comité en unos pocos miles de dólares por elección.</li>
        <li><strong>Gasto externo:</strong> dinero que gastan grupos como los super PAC para apoyar al candidato u oponerse a él sin coordinar con la campaña, según lo informado a la FEC.</li>
      </ul>
      <p>Aquí no se nombra a ningún donante individual, y las reglas de la FEC prohíben usar los nombres de donantes para pedir contribuciones o con fines comerciales.</p>

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

      <h2>De dónde vienen los datos</h2>
      <ul className="plain">
        <li><strong>Miembros, períodos, comités:</strong> el conjunto de datos de dominio público congress-legislators.</li>
        <li><strong>Votaciones nominales:</strong> el Secretario de la Cámara y Senate.gov, registradas tal como se publicaron.</li>
        <li><strong>Proyectos, copatrocinadores, resúmenes:</strong> registros GovInfo Bill Status de la Biblioteca del Congreso. Los resúmenes los escribe el Servicio de Investigación del Congreso, que es apartidista, y se publican en inglés.</li>
        <li><strong>Compraventa de acciones:</strong> Informes Periódicos de Transacciones del Secretario de la Cámara y del sistema electrónico de divulgación financiera del Senado.</li>
        <li><strong>Finanzas de campaña:</strong> la Comisión Federal de Elecciones, totales por ciclo de dos años.</li>
        <li><strong>Su distrito:</strong> Geocodio, con los límites de distritos de la Oficina del Censo. Su dirección se usa solo para la búsqueda y nunca la guardamos. Cuando las sugerencias de dirección están activas, lo que escribe en la casilla de dirección se envía a Google Places para sugerir direcciones.</li>
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
