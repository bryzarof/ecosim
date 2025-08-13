/**
 * Cargador de sprites para Ecosim.
 *
 * Se esperan archivos PNG en el directorio "img" relativo a index.html:
 *   img/terrain_water.png   (16x16)
 *   img/terrain_grass.png   (16x16)
 *   img/terrain_dirt.png    (16x16)
 *   img/terrain_barrier.png (16x16)
 *   img/plant.png           (12x12)
 *   img/herb_0.png          (16x16)
 *   img/herb_1.png          (16x16)
 *   img/carn_0.png          (16x16)
 *   img/carn_1.png          (16x16)
 *
 * Puedes reemplazar estos archivos con tus propias imágenes.
 */

function loadSprite(file){
  const img = new Image();
  img.src = `img/${file}`;
  return img;
}

export const sprites = {
  terrain: {
    water: loadSprite('terrain_water.png'),
    grass: loadSprite('terrain_grass.png'),
    dirt: loadSprite('terrain_dirt.png'),
    barrier: loadSprite('terrain_barrier.png')
  },
  plant: loadSprite('plant.png'),
  herb: [loadSprite('herb_0.png'), loadSprite('herb_1.png')],
  carn: [loadSprite('carn_0.png'), loadSprite('carn_1.png')]
};
