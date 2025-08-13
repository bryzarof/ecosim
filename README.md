# Ecosim

Simulador de Ecosistemas.

## Desarrollo

El archivo de entrada principal es `index.html` ubicado en la raíz del repositorio. Los recursos estáticos permanecen en la carpeta `public/`.

Para iniciar el servidor de desarrollo:

```
npm run dev
```

Para generar la versión de producción:

```
npm run build
```

## Self-tests

El simulador ejecuta pruebas internas al arrancar para verificar su integridad. Estas *self-tests* solo se ejecutan cuando la variable de entorno `NODE_ENV` tiene un valor distinto de `production`.

Para habilitarlas basta con ejecutar el entorno de desarrollo habitual (`npm run dev`). Para inhabilitarlas, establece `NODE_ENV=production` antes de iniciar el proceso, por ejemplo:

```
NODE_ENV=production npm run dev
```

## Menú radial

`initRadialMenu` devuelve una función `destroy` que remueve los listeners añadidos.
Esto permite montar y desmontar el menú de forma dinámica sin pérdidas de memoria.

```js
const destroy = initRadialMenu('#radialMenu', opciones);
// ... al desmontar el menú
destroy();
```
