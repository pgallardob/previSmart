# Estado técnico de la entrega — 1.3.57

La revisión 1.3.56 conserva la lógica funcional de 1.3.55 y retira importes particulares que habían quedado como ejemplos en una guía y un comentario del parser. Añade una regresión de publicación para impedir que esos ejemplos reaparezcan; no incorpora expedientes ni nuevos datos personales a la distribución.

En 1.3.57 se corrige una actualización explícita durante la primera visita: el worker nuevo se activaba, pero la página conservaba los módulos cargados antes porque no tenía controlador al arrancar. Ahora la confirmación de actualización habilita una sola recarga, mientras la instalación inicial, la cancelación y las operaciones en curso siguen sin provocarla. Dos pruebas reproducen y verifican esta condición; la lógica financiera permanece intacta.

**Cierre de 1.3.57: 235 comprobaciones aprobadas** (67 Node, 10 profundas, 35 de endurecimiento, 1 CSP, 87 especializadas, 21 de aplicación, 13 de compatibilidad/Pages y 1 portable). Se volvió a ejecutar la batería funcional completa y la compatibilidad tras las correcciones de publicación/actualización. El ensayo WebKit espera a que termine la referencia UF inicial antes de generar el PDF: un cambio tardío de UF invalida deliberadamente un documento en curso para no entregar un cálculo desactualizado.

## Alcance vigente de la entrega

Operación individual de asesoría documental, preparación de comparaciones y simulaciones revisables. La versión 1.3.55 amplía las familias CNU y tablas de invalidez, conecta recálculos referenciales TM2020, capitales destinados y cargos declarados, añade sobrevivencia RP separada y planificación bajo hipótesis explícitas. No reimplementa el CNU, PDF ni reutilización automática ya entregados. Las guías actuales se incluyen en los paquetes.

| Función | Cobertura implementada | Límite que no se presenta como resuelto |
|---|---|---|
| CNU / RP | Titular, cónyuge, AUC con hijos comunes declarados, filiación, padres y niños con invalidez; una familia revisada; MI-H/MI-M-2020 | Grupos adultos concurrentes, tablas históricas, liquidación SIS y ajustes oficiales finales |
| Sobrevivencia RP | Capital remanente propio, CNU solo beneficiarios, pagos del grupo, topes de orfandad y regla del hijo único de 23 con meses declarados | No mezcla el grupo con pensión individual ni acredita derechos/fallecimiento; combinaciones especiales no verificadas quedan bloqueadas |
| Planificación | Aportes y retorno real declarados, capital compuesto y pensión CNU hipotética con tasa/familia explícitas | No es proyección oficial AFP, tasa futura publicada ni precio de aseguradora |
| Líquida | Salud/plan declarados, impuesto del período y efecto separado del cargo AFP informado | No supone Fonasa, plan cero, exenciones ni beneficios concedidos |
| AFP | Modelo RPA y ruta documental manual para las siete AFP | Las otras seis automatizaciones no están habilitadas |
| Teléfonos | PWA independiente, importación, PDF, archivos y uso sin conexión probados por motores | Emulación no acredita una prueba física Android/iPhone |

Los cálculos bloqueados por datos faltantes o casos no verificados no se habilitan con valores inventados. Las referencias de aseguradoras están fechadas y se actualizan mediante entregas investigadas, no como precios personales en tiempo real.

### Verificación del 13/10/2026

**232 comprobaciones funcionales aprobadas en 1.3.55:** 65 Node, 10 profundas, 35 de endurecimiento, 1 CSP, 86 especializadas, 21 de aplicación, 13 de compatibilidad/Pages y 1 portable. Los escenarios nuevos y sus PDF se verificaron en Edge, Firefox y WebKit emulado. La revisión de publicación 1.3.56 añade una comprobación de ejemplos sin importes particulares y vuelve a verificar distribución e ingesta; no se presenta como una nueva batería funcional ni como una reimplementación.

App y RPA locales coinciden en 1.3.55/runtime v22.23.3 y modo real; preflight e integridad aprobados. Portable: 958 archivos verificados; web/Pages: 193 archivos de software y guías públicas. No se consultaron cuentas AFP durante este cierre ni se importaron valores hipotéticos a un expediente real. Tras el reinicio del entorno, el navegador de revisión estaba sin cartera; no se reconstruyeron ni sustituyeron expedientes a ciegas, ni se afirma haber vuelto a cotejar la huella del cliente anterior desde esa sesión.

La comprobación se realiza **por función**, no condicionando todo el producto a contraseña/PIN Windows, copias adicionales o firma del editor. Las decisiones de seguridad se documentan como riesgos; no se presentan como protección cumplida ni se bloquean las correcciones independientes.

## Funciones y dependencias reales

| Función | Dependencia técnica | No depende de |
|---|---|---|
| Cartera, carga PDF y archivo cifrado por cliente | App íntegra, navegador compatible, permisos locales y contraseña del archivo cifrado | RPA, PIN Windows, servidor central, emisión SCOMP |
| Consulta automática Modelo | Windows/Edge y RPA local en modo real; autorización previa registrada y vigente | GitHub Pages o conexión entre asesores |
| Pensión líquida / impuesto | Datos válidos, UF de referencia y tabla mensual vigente | RPA para operar la calculadora |
| Propuesta no oficial | Antecedentes registrados y sus fuentes/fechas | Acceso de partícipe para emitir certificados oficiales |
| Publicación estática Pages | Repositorio limpio y Pages configurado; revisión de términos | Datos de clientes en GitHub o servicio central de expedientes |

`node herramientas/preflight-produccion.mjs` informa disponibilidad por función. Si el RPA no está, puede seguir disponible el trabajo documental; si una tabla tributaria vence, no se calcula impuesto con ella, pero no se bloquea por eso guardar PDF.

## Compatibilidad comprobable antes de publicar

Una cartola descargada puede cerrar en una fecha anterior a la consulta del portal. Cuando existe saldo capturado por RPA, su importe y fecha se conservan; la cartola se registra como referencia separada con su corte, documento y hash. La revisión de extracción y la propuesta muestran ambos datos sin tratarlos como el mismo saldo. Una diferencia entre estos importes no se clasifica automáticamente como error, conflicto de saldo o cotizaciones impagas. Las diferencias de formato de un mismo RUT no se consideran conflictos de identidad.

### Cotizaciones y cartolas: revisión oficial del 12/10/2026

- Para trabajadores dependientes, las cotizaciones se pagan dentro de los primeros diez días del mes siguiente al de las remuneraciones; si el día 10 es sábado, domingo o festivo, se prorroga al siguiente hábil. Si declaración y pago son electrónicos, el plazo es hasta el 13, incluso sábado, domingo o festivo. No hay una regla general de declarar entre el 10–12 y pagar entre el 12–14. [Superintendencia de Pensiones: plazos](https://www.spensiones.cl/portal/institucional/594/w3-article-2728.html).
- La cartola cuatrimestral agrupa enero–abril, mayo–agosto y septiembre–diciembre. Las fechas de despacho son junio 15–30, octubre 15–31 y febrero 15–28, respectivamente. El saldo corresponde al último día del cuatrimestre informado. Por ello, el 12 de octubre una cartola de enero–abril puede seguir siendo la última disponible; esto no prueba incumplimiento. [Compendio, Libro I, Título IV, Capítulo III, números 3, 4 y 8.1](https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-5814.html).
- El mes de remuneración, la fecha de pago, la fecha de acreditación y el corte de saldo son conceptos distintos. La aplicación no desplaza automáticamente los meses del certificado ni atribuye la diferencia completa de saldos a una causa no demostrada. Movimientos, valorización y distintos períodos deben cotejarse con sus fuentes.

### Ubicación de la autorización firmada

En Captura, seleccionar dónde se conserva el documento firmado (archivo local, papel, correo u otra ubicación) y completar cómo encontrarlo. El campo identifica un documento existente; no solicita la clave AFP, no firma por el afiliado y no adjunta ni verifica automáticamente el archivo. Las autorizaciones anteriores conservan su validez y referencia, sin inventarles una ubicación.

El detalle es una nota elegida por el operador, no un código que deba obtener: por ejemplo, `Autorizacion-firmada.pdf, carpeta Documentos`, o `Carpeta física del cliente, sección Autorizaciones`. La ayuda muestra el ejemplo correspondiente a la opción seleccionada. Al guardar aparece «Autorización registrada» con la ubicación declarada; es confirmación del registro, no validación automática de la firma o del archivo.

La ayuda y el ejemplo comparten un bloque de diseño, con separación entre párrafos. Las pruebas de navegador verifican que input, ayuda, ejemplo y confirmación no se superpongan a 320, 390, 768 y 1280 píxeles, para las cuatro ubicaciones disponibles.

## Cálculos con fuentes reales

En 1.3.54 se añade **Ajustes → Parámetros de cálculo** para incorporar tablas SII mensuales y tasas RP cotejadas, con responsable, vigencia e historial local. Los motores ya entregados se reutilizan, sin reescribir CNU ni expedientes. La aplicación no obtiene ni inventa nuevas publicaciones; los archivos de prueba de períodos futuros son sintéticos. Guía y formato: [PARAMETROS_CALCULO.md](PARAMETROS_CALCULO.md). Esto no completa por sí solo las otras ampliaciones actuariales, actualizaciones normativas ni validaciones en teléfonos físicos.

Verificación de 1.3.54: 204 comprobaciones aprobadas (65 Node, 10 profundas, 30 de endurecimiento, 1 CSP, 65 especializadas, 21 de aplicación, 11 de compatibilidad/Pages y 1 portable). Las ocho comprobaciones adicionales cubren el motor de parámetros, revisión desde Ajustes y carga/exportación de historial en Edge, Firefox y WebKit emulado. Los paquetes incluyen la guía de actualización de parámetros y se preparan sin publicar. La comprobación local conservó la huella del expediente, sin incorporar parámetros de prueba; sus importes particulares no forman parte de esta guía pública.

En 1.3.53 se compacta la presentación en pantalla: gráficos con ancho máximo 480 px sin ampliación automática, barras de 20 px y títulos Inter con jerarquía moderada en todas las vistas. Se corrigen tokens tipográficos inválidos en etiquetas y tablas del informe. No cambian los montos, las fuentes ni el diseño del PDF nativo; los controles mantienen su tamaño de uso.

Verificación 12/10/2026: 196 comprobaciones aprobadas (65 Node, 10 profundas, 29 de endurecimiento, 1 CSP, 60 especializadas, 21 de aplicación, 9 de compatibilidad/Pages y 1 portable). La regresión de escala comprueba ambos gráficos a 320, 390, 867, 1280 y 1920 px, en temas claro y oscuro. Tras aplicar la actualización local, el gráfico real mide 480 × 126 px y el título 21,25 px en una ventana de 867 px, sin scroll horizontal; la huella del expediente permanece idéntica. Se reconstruyeron los paquetes Windows, web y Pages, sin publicación en Internet. Revertir esta unidad solo afecta la escala de pantalla y sus pruebas; no modifica datos ni el motor PDF.

En 1.3.52 se incluyen tres fichas preparatorias de aseguradoras **sin exigir SCOMP**: BICE Vida, Confuturo y Consorcio Vida, con modalidades, cláusulas publicadas, clasificaciones de informes fechados alojados en CMF, observaciones, costos no publicados y enlaces oficiales. Aparecen en Propuesta y ofertas y en los documentos del cliente; después se cruzan con cotizaciones importadas o manuales. No son un ranking ni precios personales inventados. Investigación y límites: [ASEGURADORAS_PREPARACION.md](ASEGURADORAS_PREPARACION.md).

En 1.3.51 el documento se organiza para el cliente: resumen de capital e ingresos, tablas comparativas, gráficos y casos numéricos antes del anexo técnico. Los escenarios de capital RP son ejercicios matemáticos explícitos, no pronósticos ni precios de aseguradoras. Las cotizaciones reales, datos faltantes y condiciones distintas conservan su origen. El anexo mantiene fórmulas y fuentes; no se eliminan datos para simplificar la lectura. Diseño y controles: [DOCUMENTO_CLIENTE.md](DOCUMENTO_CLIENTE.md).

En 1.3.50 se añade el flujo opcional **SCOMP recibido por correo → consolidación AFP + SCOMP → oferta base → comparación presencial**. Cada original conserva su extracción y referencia al archivo; no sustituye el saldo AFP ni elimina ofertas previas/manuales. Los documentos usan la fuente y oferta base elegidas, e incorporan la comparación física como registro manual separado. La propuesta independiente sin SCOMP permanece disponible. Guía y límites: [CONSOLIDACION_SCOMP.md](CONSOLIDACION_SCOMP.md).

En 1.3.49 la simulación RP se reutiliza automáticamente en Beneficios, Pensión líquida, Sobrevivencia, Modalidades, Reporte y Propuesta, sin exigir un certificado SCOMP ni copiar cifras entre pantallas. Las pensiones informadas por fuentes tienen prioridad. Las cifras calculadas no se guardan como pensiones AFP ni como ofertas de aseguradoras; los cambios del saldo y antecedentes recalculan el escenario, y se respetan los montos manuales explícitos. El origen simulado queda visible.

La preparación local de la propuesta no equivale a contratar una renta vitalicia: los precios comerciales y la aceptación corresponden a una aseguradora. La consulta y selección oficial de modalidad tienen su propio procedimiento. [Fuente CMF](https://www.cmfchile.cl/educa/621/w3-propertyvalue-535.html). No se exige ese procedimiento para usar los cálculos y documentos preparatorios locales.

La pensión mensual informada se reutiliza entre Beneficios, Elegibilidad, Modalidades y Pensión líquida, tanto si viene en UF como en CLP. No se deduce una pensión desde el saldo ni se escala la oferta de otra persona. El tipo de fuente y la conversión referencial se mantienen visibles.

Las relaciones aritméticas verificadas con el certificado de referencia son UF→CLP, diferencia anual entre ofertas del mismo documento y grupo de cláusulas, aumento temporal y meses garantizados. La garantía estatal se evalúa como ejercicio condicionado: `P` si `P ≤ G`, o `mínimo(G + 75% × (P − G), 45 UF)` si `P > G`, con `P` y `G` en pesos. El parámetro PGU de referencia se limita a su período verificado; no equivale a PGU concedida al cliente. Las tasas particulares del ejemplar no se aplican a otros afiliados.

### Certificado informativo de cálculos, no oficial

En 1.3.48 el encabezado es **PREVISMART - DOCUMENTO (simulación)**. El PDF usa tablas de dos columnas con bordes y encabezados repetidos; conserva la aclaración no oficial por separado. La sección actuarial reproduce los ejemplos CNU de la Nota Técnica 9 de la SP usando TM2020. El resultado es un escenario separado de la pensión informada por AFP: requiere sexo y nacimiento de todos los integrantes, confirmación del grupo completo sin invalidez y meses devengados. Utiliza solo el saldo obligatorio y edades en años cumplidos; no incluye ajustes ni acredita elegibilidad. Alcance, fuentes y restricciones: [SIMULACION_RP.md](SIMULACION_RP.md).

Disponible en Sobrevivencia, Reporte y la vista previa de Ofertas. Se genera con el expediente activo, muestra las fuentes y sus fechas, cálculos posibles y datos faltantes. **SCOMPtipo.PDF es referencia de estructura y relaciones aritméticas, no fuente de ofertas del cliente**: pertenece a otra persona y no contiene el CNU ni la fórmula actuarial completa para determinar una nueva pensión de retiro programado o cotización de aseguradora.

1. Revisar el informe en pantalla.
2. Pulsar **Generar PDF**. El documento se crea en el dispositivo con pdf-lib 1.17.1, sin enviar datos personales a un servicio externo.
3. Usar **Ver PDF listo** o **Descargar PDF listo** para abrirlo o guardarlo. También sigue disponible Imprimir / PDF del navegador.

El PDF conserva el aviso no oficial en todas las páginas, no incluye credenciales y no sirve para aceptar una oferta. Cambiar de cliente, actualizar el expediente o cambiar la UF invalida un enlace anterior para no descargar un documento bajo otra ficha. No se completa una pensión mensual a partir del saldo: si no está informada, se mantienen pendientes sus cálculos dependientes. Los límites legales no equivalen a pagos concedidos, y meses observados en cotizaciones no se convierten en vida laboral completa. Si la fuente PDF no representa un carácter, se informa el problema y no se sustituye silenciosamente la identidad; puede usarse la impresión del navegador.

La primera instalación incluye una referencia UF fechada, obtenida del SII vía mindicador.cl. Si la API externa no responde, se muestra como **guardada**, no «en línea»; se conserva una referencia local más reciente. El respaldo de la entrega no se actualiza diariamente por sí solo: la consulta directa sigue siendo el mecanismo de actualización. Revisar siempre la fecha, especialmente si se usa sin conexión.

Se prueban Edge/Chromium, Firefox y WebKit con perfil/viewport iPhone. Se detectó un fallo al persistir `File`/`Blob` en IndexedDB con WebKit y se corrigió usando `ArrayBuffer` para nuevos registros. La lectura reconstruye el Blob y mantiene compatibilidad con los registros antiguos, sin borrar la base ni perder PDF.

Las pruebas incluyen creación de clientes, lectura PDF, cifrado/descarga, reapertura preservando otros clientes, nombres y contactos por instalación y ausencia de scroll horizontal. WebKit emulado **no equivale a un iPhone físico**; esta distinción no se presenta como un defecto pendiente de código, sino como validación de plataforma que se ejecutará al disponer del dispositivo/URL real.

```powershell
# Después de reconstruir y preparar el sitio Pages:
cd rpa
npm run test:cross-browser
```

Para preparar esos motores de prueba: `node node_modules/playwright/cli.js install webkit firefox`. Los navegadores de prueba no se incluyen en la distribución y no cambian la cuenta o PIN Windows.

## Distribución pública de solo software

El repositorio limpio `pgallardob/previSmart` y la URL `https://pgallardob.github.io/previSmart/` ya existen. La distribución preparada en `dist/PreviSmart-pages/` se publica con un workflow manual de solo `site/`, sin historial de desarrollo ni expedientes. La versión efectiva se comprueba en la URL y su manifest; preparar el paquete no demuestra que haya sido desplegado. Las pruebas físicas se registran separadamente.

Una firma de editor genuina puede añadirse con el flujo preparado si se dispone del certificado/SDK; su ausencia no impide iniciar el portable, pero se informa que el ejecutable no está firmado. No se fabrica una identidad de editor.

## Decisiones y verificaciones separadas del funcionamiento

- El operador descartó contraseña/PIN Windows y copias adicionales. No se configura ninguno ni se usan como condición de las pruebas de código; los riesgos de acceso o pérdida siguen documentados.
- Registro profesional: declarado por el usuario; consulta oficial automatizada respondió 403. Esto no bloquea creación de clientes/PDF ni prueba invalidez; no se declara acreditación verificada por el software.
- Emisión oficial SCOMP: fuera del alcance elegido, que es propuesta no oficial. No se usa como pendiente de la propuesta.
- Base de trabajo del navegador: no queda cifrada automáticamente por guardar un archivo AES. No se anuncia cifrado integral del equipo ni disponibilidad redundante.
