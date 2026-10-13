# Distribuir PreviSmart con GitHub Pages

La distribución estática está publicada en **https://pgallardob.github.io/previSmart/** desde el repositorio limpio `pgallardob/previSmart`, separado del desarrollo. Pages distribuye software; los clientes y PDF permanecen en cada instalación. La versión vigente debe comprobarse en la página y su manifest, no inferirse del paquete local.

## Antes de publicar

- Revisar las [restricciones de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits): GitHub no permite usarlo como alojamiento gratuito de negocios transaccionales o SaaS comercial, y advierte contra transacciones sensibles. No se implementó venta, servidor de clientes ni envío de contraseñas a Pages. Esta preparación no certifica que cualquier modelo comercial cumpla sus términos.
- El sitio será accesible en Internet. Un repositorio privado no garantiza un sitio privado; las opciones de repositorios/Pages dependen del plan. Nunca subir documentos de clientes, configuraciones privadas, claves ni diagnósticos.
- **No publicar el repositorio de trabajo ni su historial.** Puede contener referencias históricas personales. Usar un repositorio nuevo con solo la distribución preparada.

## Preparación local

```powershell
node herramientas/build-web.mjs
node herramientas/preparar-github-pages.mjs
node herramientas/verificar-sitio-pages.mjs dist/PreviSmart-pages/site
```

La carpeta `dist/PreviSmart-pages/` contiene exclusivamente:

```text
site/                         PWA y manifest de integridad
.github/workflows/pages.yml   publicación manual de solo site/
.github/scripts/              verificación previa a publicación
README.md
.gitignore
.gitattributes               conserva los bytes cubiertos por el manifest
```

El preparador no crea un repositorio Git, no hace push ni cambia la visibilidad de ningún repositorio. El código de la app se conserva relativo a su subcarpeta, por ejemplo `/prevismart/`, sin necesidad de un dominio propio.

La distribución incluye `site/** -text` en `.gitattributes`: Git debe conservar exactamente los bytes cubiertos por los hashes, sin normalizar finales de línea al pasar de Windows al checkout Linux de Actions. Comprobar también la copia obtenida desde Git antes de publicar.

## Publicación manual

Para actualizar la instalación existente, usar un clon limpio de `pgallardob/previSmart`, comprobar que no tenga trabajo pendiente, copiar únicamente la distribución verificada y ejecutar el workflow manual. No copiar `.git` ni hacer push desde el repositorio de desarrollo. Los pasos siguientes describen una instalación nueva en otra cuenta, no pendientes de la URL ya existente.

1. Crear un repositorio nuevo en tu cuenta u organización, después de revisar términos y visibilidad. No importar el historial del proyecto ni copiar su `.git`.
2. Subir el contenido de **`dist/PreviSmart-pages/`**, incluyendo `.github`, a la raíz de ese repositorio. No subir la carpeta del proyecto, `rpa`, `dist/PreviSmart`, `respaldo`, `respaldos` ni el perfil de navegador.
3. En **Settings → Pages → Build and deployment → Source**, seleccionar **GitHub Actions**.
4. En **Actions → Publish static PreviSmart → Run workflow**, iniciar la publicación manual. No se publica automáticamente con cada push.
5. El workflow verifica hashes y estructura, rechaza archivos privados y sube **solo `site/`**. Las acciones oficiales están fijadas por SHA de commit.
6. Esperar a que GitHub muestre la URL real de la publicación, normalmente `https://USUARIO.github.io/REPOSITORIO/`. Comprobar HTTPS y habilitar **Enforce HTTPS** si esa opción se ofrece. La URL no se considera existente hasta que el despliegue finalice.
7. Abrir esa URL en Android/iPhone e instalar/agregar a pantalla principal. Cada asesor configura su propio responsable en Ajustes. Completar pruebas reales de instalación, importación PDF, archivo cifrado, reapertura y funcionamiento offline antes de declarar soporte operativo de esos teléfonos.

Para subir muchos archivos sin depender del límite de carga de la interfaz web, puedes usar Git **solo después de crear el repositorio destino**. Ejecuta desde la carpeta limpia, no desde el repositorio de desarrollo:

```powershell
cd dist/PreviSmart-pages
git init
git add .
git commit -m "feat: add static PreviSmart distribution"
git branch -M main
git remote add origin https://github.com/USUARIO/REPOSITORIO.git
git push -u origin main
```

Sustituir la URL por la del repositorio nuevo y completar la autenticación de GitHub cuando se solicite. No poner tokens ni contraseñas en la URL o el documento. Son instrucciones para una instalación nueva y no autorizan subir el historial de trabajo.

## Protección y límites

La distribución Pages incluye CSP por metadato para restringir recursos y bloquear el envío nativo de formularios. **No equivale a todas las cabeceras HTTP del lanzador Windows**: `frame-ancestors`, por ejemplo, no se aplica mediante ese metadato. No se configuraron cabeceras personalizadas que GitHub Pages no ofrece en este flujo.

El almacenamiento del navegador se separa por origen, no por nombre de repositorio. Otros sitios de la misma cuenta bajo `USUARIO.github.io` comparten origen: evitar alojar código no confiable en ese origen y no usar instalaciones de prueba del mismo origen con datos reales. Un origen dedicado y controlado reduce ese riesgo.

El servicio RPA Windows en 8787 no se publica en Pages ni se convierte en una API móvil. Las credenciales AFP no se solicitan en la interfaz web externa; los teléfonos usan carga documental. Los archivos de cliente se cifran localmente, pero la base de trabajo del navegador no se cifra automáticamente con esa contraseña.

Fuentes consultadas: [workflows de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https), [restricciones](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
