# Uso individual en Windows, Android e iPhone

Cada asesor trabaja con su propia instalación y clientes locales. **No hay servidor de expedientes, cuenta compartida ni sincronización entre asesores.** La distribución web publica solo el software, nunca los documentos de los clientes.

## Windows

1. Distribuye la carpeta portable completa `dist/PreviSmart/` y abre `PreviSmart.exe`.
2. En **Ajustes → Responsable de esta instalación**, guarda tu nombre y contacto. La inscripción es declarativa, no una acreditación verificada.
3. Crea tus propios clientes. En Captura puedes importar PDF y usar Modelo RPA con Edge local cuando exista autorización previa.
   Antes de consultar, registra la fecha efectiva, referencia y cotejo de la autorización firmada. La app bloquea consultas si falta el registro, venció, fue revocado o pertenece a otro responsable. No firma documentos por el cliente.
4. Para guardar el expediente cifrado, en **Captura → Documentos cifrados por cliente** elige una ubicación. La app crea `respaldos/Cliente-<nombre>-<id>/expediente.prevismart.json`.
5. Introduce una contraseña propia de al menos 12 caracteres, distinta de las claves AFP. El archivo contiene solo ese cliente y sus documentos; los demás clientes y las credenciales quedan fuera. Reemplazar un archivo existente requiere confirmación.

El archivo se cifra con AES-256-GCM/PBKDF2-SHA256 y no depende de que EFS esté disponible. EFS de la carpeta de prueba existente pertenece al usuario Windows de ese equipo, no a todas las instalaciones. Guardar un archivo no implica borrado de los originales ni cifrado de toda la base de trabajo del navegador.

Nuevos documentos se conservan internamente como bytes para compatibilidad entre motores; las versiones anteriores que guardaron Blob siguen siendo legibles. No se borra ni reemplaza la base por cambiar ese formato interno.

Cancelar el diálogo durante una fase pendiente de cifrado/importación invalida la operación. En escritura por carpeta se comprueba la vigencia antes de cerrar el escritor y se abortan bytes pendientes cuando corresponde; un guardado ya completado por el sistema no se deshace por cancelar después. Si cambia el cliente activo, se limpia el aviso/enlace anterior para no presentar un archivo como si perteneciera al nuevo expediente.

## Android e iPhone

Necesitan una **dirección HTTPS donde se distribuya la PWA estática**. `localhost:8321` de otro computador no sirve como instalación del teléfono. Una carpeta descargada o una URL `file://` no sustituye ese origen seguro.

El operador eligió GitHub Pages. La distribución está publicada en `https://pgallardob.github.io/previSmart/`; el paquete separado y la publicación manual se describen en [GitHub Pages](GITHUB_PAGES.md). El sitio distribuye software, nunca expedientes privados.

1. Publica únicamente el contenido de `dist/PreviSmart-web/` en un alojamiento estático HTTPS. No publiques `rpa/`, `respaldo/`, `respaldos/`, `.env`, perfiles de navegador ni datos exportados.
2. En Android, abre la dirección en un navegador compatible y usa su opción de instalar/agregar a pantalla principal si se ofrece.
3. En iPhone, abre la dirección en Safari y usa **Compartir → Añadir a pantalla de inicio**.
4. Configura tu propio responsable y crea tus clientes. En **Captura → Descargar documentos desde el teléfono**, selecciona la AFP y abre su sitio oficial. Inicia sesión únicamente allí, descarga los PDF en Archivos/Descargas y cierra la sesión de la AFP. Vuelve a PreviSmart, selecciona el tipo de documento y pulsa **Seleccionar PDF descargado → Guardar documento**. Revisa los datos extraídos antes de aplicarlos al expediente. Es un flujo manual independiente del computador; no una descarga automatizada ni una API AFP. PreviSmart no recibe las credenciales usadas en el portal.
5. En Captura, pulsa **Guardar cliente cifrado**, introduce y confirma la contraseña y luego pulsa **Descargar archivo cifrado listo**. Guarda el archivo en Archivos/Descargas y organízalo manualmente por cliente si el navegador no ofrece escritura directa en carpetas.
   Para respetar el almacenamiento exclusivamente local elegido, usa almacenamiento interno/«En mi iPhone», no una ubicación de nube sincronizada sin haberla autorizado. La ubicación efectiva depende del sistema y debe comprobarla el operador.

La app no puede confirmar dónde guardó el archivo el sistema ni escribir automáticamente en cualquier carpeta de Android/iOS. La ruta sin selector de carpetas se verifica con pruebas de navegador; **los flujos de descarga y apertura de archivos de cada AFP en teléfonos físicos requieren validación real**. El ejecutable Windows y Edge RPA no funcionan en Android/iOS.

## Volver a abrir un cliente cifrado

En Captura, **Abrir cliente cifrado** pide su contraseña y lo incorpora únicamente si su identificador todavía no existe en esa instalación. Los demás clientes se conservan. Si ya existe, la app rechaza la operación para no sobrescribir un expediente; no es un mecanismo automático de sincronización o actualización entre equipos.

No uses la opción de restauración de cartera completa de Ajustes para un archivo de cliente: son formatos distintos y la app los rechaza cuando no corresponde.

## Límites de almacenamiento y seguridad

- La contraseña del archivo no se guarda ni se puede recuperar. No compartir archivos o claves con otros asesores sin autorización específica del afiliado.
- La base local de trabajo del navegador no se cifra automáticamente con esta contraseña. Protege el dispositivo, sus cuentas y bloqueo de pantalla; borrar datos del navegador puede borrar la cartera.
- Los nombres de archivos/carpetas identifican al cliente aun cuando el contenido esté cifrado. Evita ubicaciones públicas o compartidas.
- Guardar solo en un equipo respeta la elección del operador, pero no elimina el riesgo de fallo del disco, pérdida del teléfono o pérdida de la contraseña.
- La autorización 1.2 refleja custodia individual y ausencia de sincronización. La conservación de 30 días hábiles desde firma no produce eliminación automática; revisa obligaciones legales y todas las copias existentes antes de eliminar.

## Preparar la distribución web

```powershell
node herramientas/build-web.mjs
node herramientas/verificar-release.mjs dist/PreviSmart-web
```

Se generan `dist/PreviSmart-web/` y `dist/PreviSmart-web.zip`, con manifest de integridad y sin servicio RPA. Ese comando **no publica nada en Internet** ni modifica el ERP en 3000.
