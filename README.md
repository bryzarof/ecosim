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

## Menú radial

`initRadialMenu` devuelve una función `destroy` que remueve los listeners añadidos.
Esto permite montar y desmontar el menú de forma dinámica sin pérdidas de memoria.

```js
const destroy = initRadialMenu('#radialMenu', opciones);
// ... al desmontar el menú
destroy();
```
