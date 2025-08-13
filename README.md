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

## Añadir nuevas especies

Para que una nueva especie pueda aparecer en el mapa:

1. Define su configuración en `speciesConfig` y sus genes por defecto.
2. Añade una constante en el objeto `TOOL` de `main.js`.
3. Crea una función generadora en el objeto `spawners` dentro de `ui.js` que inserte el animal en `state.animals`.
4. Incluye un botón o entrada de menú que utilice la nueva herramienta.
