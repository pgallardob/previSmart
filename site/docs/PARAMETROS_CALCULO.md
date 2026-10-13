# Actualizar parámetros sin reinstalar

En **Ajustes → Parámetros de cálculo** se pueden incorporar tablas mensuales SII y tasas RP de nuevos períodos. Se reutilizan los motores existentes: no se reemplaza el cálculo CNU, la extracción AFP ni los expedientes. Las referencias incluidas siguen produciendo los mismos resultados de octubre de 2026.

## Uso

1. Descargar el formato con los valores incluidos. Es una referencia de estructura, no una tabla para otro mes.
2. Preparar el JSON con los valores efectivamente publicados para el nuevo período. Conservar fuente, URL oficial y fecha de publicación; no desplazar fechas de valores antiguos para hacerlos parecer vigentes.
3. Cargar el archivo y revisar todos sus valores contra la publicación enlazada.
4. Registrar al responsable, confirmar el cotejo y aplicar. Abrir nuevamente la calculadora para utilizar los parámetros correspondientes a su fecha.

La aplicación comprueba estructura y consistencia, **no autenticidad ni aprobación normativa**. No descarga ni inventa valores futuros. Tampoco actualiza PGU, otras reglas legales, feriados, tablas de mortalidad o fichas de aseguradoras con este archivo.

## Formato

| Campo | Impuesto mensual | Tasa RP |
|---|---|---|
| `tipo` | `impuesto-mensual` | `tasa-rp` |
| Período | `periodo`: `AAAA-MM` | `desde` y `hasta`: `AAAA-MM-DD` |
| Valores | Ocho `tramos`, con `desde`, `hasta`, `factor`, `rebaja`; último `hasta` es `null` | `tasa` anual decimal |
| Referencia | `fuente`, `url` HTTPS SII, `publicadoEn` | `fuente`, `url` HTTPS SP, `publicadoEn` |

El contenedor tiene `schemaVersion: 1` y una lista `parametros`. Máximo 64 KB y 24 parámetros por archivo. Una fecha de cálculo no utiliza otra mensualidad ni una tasa fuera de su intervalo.

## Historial y límites

- Revisiones locales separadas de clientes y credenciales; no viajan en los archivos de expedientes.
- Correcciones del mismo intervalo conservan la revisión anterior y usan la última para nuevos cálculos. Reimportar exactamente el mismo parámetro no lo duplica.
- Se rechazan intervalos RP parcialmente superpuestos y tablas incompletas/discontinuas. Un fallo de guardado conserva el historial anterior; uno corrupto bloquea cálculos parametrizados sin borrar evidencia.
- Exportar historial conserva valores, fuentes y responsable. Es un registro de auditoría; no se importa como un paquete de valores sin nueva revisión.
- Máximo 100 revisiones; no se eliminan automáticamente. Documentos ya descargados no se reescriben. Enlaces PDF listos se invalidan cuando cambian parámetros.
- El diagnóstico RPA/terminal no lee las revisiones del navegador: la vigencia efectiva se consulta en Ajustes y en los propios cálculos.

## Verificación de esta unidad

`node --test rpa/test/parametros-normativos.test.mjs` verifica períodos, límites de mes en Chile, revisión, historial, deduplicación, consistencia, procedencia declarada en informes, cuotas de almacenamiento y preservación de expedientes. Los períodos posteriores utilizados en pruebas son **sintéticos**, no publicaciones normativas reales.

Revertir esta unidad retira únicamente la selección de revisiones locales y vuelve a los parámetros incluidos. No requiere borrar expedientes ni PDF y no altera las ecuaciones CNU.
