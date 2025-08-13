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

### Pruebas internas

El simulador ejecuta pruebas internas de sanidad (`runSelfTests`) únicamente cuando
`NODE_ENV` no es `production`.

- Para habilitarlas, inicia el proyecto con `NODE_ENV=development` (valor por defecto en `npm run dev`).
- Para inhabilitarlas, ejecuta con `NODE_ENV=production`.
