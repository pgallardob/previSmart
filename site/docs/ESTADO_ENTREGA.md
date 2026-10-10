# Estado técnico de la entrega — 1.3.40

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

La primera instalación incluye una referencia UF fechada, obtenida del SII vía mindicador.cl. Si la API externa no responde, se muestra como **guardada**, no «en línea»; se conserva una referencia local más reciente. El respaldo de la entrega no se actualiza diariamente por sí solo: la consulta directa sigue siendo el mecanismo de actualización. Revisar siempre la fecha, especialmente si se usa sin conexión.

Se prueban Edge/Chromium, Firefox y WebKit con perfil/viewport iPhone. Se detectó un fallo al persistir `File`/`Blob` en IndexedDB con WebKit y se corrigió usando `ArrayBuffer` para nuevos registros. La lectura reconstruye el Blob y mantiene compatibilidad con los registros antiguos, sin borrar la base ni perder PDF.

Las pruebas incluyen creación de clientes, lectura PDF, cifrado/descarga, reapertura preservando otros clientes, nombres y contactos por instalación y ausencia de scroll horizontal. WebKit emulado **no equivale a un iPhone físico**; esta distinción no se presenta como un defecto pendiente de código, sino como validación de plataforma que se ejecutará al disponer del dispositivo/URL real.

```powershell
# Después de reconstruir y preparar el sitio Pages:
cd rpa
npm run test:cross-browser
```

Para preparar esos motores de prueba: `node node_modules/playwright/cli.js install webkit firefox`. Los navegadores de prueba no se incluyen en la distribución y no cambian la cuenta o PIN Windows.

## Publicación diferida por decisión del usuario

El repositorio no se crea ni se sube hasta que el usuario lo decida. La preparación está en `dist/PreviSmart-pages/`; las rutas funcionan en una subcarpeta de proyecto y el workflow es manual. No se afirma que exista un despliegue HTTPS o una instalación física que no se haya ejecutado.

Una firma de editor genuina puede añadirse con el flujo preparado si se dispone del certificado/SDK; su ausencia no impide iniciar el portable, pero se informa que el ejecutable no está firmado. No se fabrica una identidad de editor.

## Decisiones y verificaciones separadas del funcionamiento

- El operador descartó contraseña/PIN Windows y copias adicionales. No se configura ninguno ni se usan como condición de las pruebas de código; los riesgos de acceso o pérdida siguen documentados.
- Registro profesional: declarado por el usuario; consulta oficial automatizada respondió 403. Esto no bloquea creación de clientes/PDF ni prueba invalidez; no se declara acreditación verificada por el software.
- Emisión oficial SCOMP: fuera del alcance elegido, que es propuesta no oficial. No se usa como pendiente de la propuesta.
- Base de trabajo del navegador: no queda cifrada automáticamente por guardar un archivo AES. No se anuncia cifrado integral del equipo ni disponibilidad redundante.
