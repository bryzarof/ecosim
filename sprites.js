/**
 * Simple sprite generator for Ecosim.
 * Generates small canvas-based sprites for animals, plants
 * and terrain textures so the simulation does not depend on
 * external image assets.
 */

function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  return c;
}

// Terrain textures -----------------------------------------------------------
function texWater(){
  return makeCanvas(16,16,(ctx)=>{
    ctx.fillStyle = '#1e40af';
    ctx.fillRect(0,0,16,16);
    ctx.fillStyle = '#2563eb';
    for(let i=0;i<16;i+=4){
      ctx.fillRect(0,i,16,2);
    }
  });
}
function texGrass(){
  return makeCanvas(16,16,(ctx)=>{
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0,0,16,16);
    ctx.fillStyle = '#22c55e';
    for(let i=0;i<20;i++){
      ctx.fillRect(Math.random()*16, Math.random()*16,1,1);
    }
  });
}
function texDirt(){
  return makeCanvas(16,16,(ctx)=>{
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(0,0,16,16);
    ctx.fillStyle = '#8b5e3c';
    for(let i=0;i<16;i++){
      ctx.fillRect(Math.random()*16, Math.random()*16,1,1);
    }
  });
}
function texBarrier(){
  return makeCanvas(16,16,(ctx)=>{
    ctx.fillStyle = '#64748b';
    ctx.fillRect(0,0,16,16);
    ctx.strokeStyle = '#94a3b8';
    ctx.strokeRect(0.5,0.5,15,15);
  });
}

// Plant sprite ---------------------------------------------------------------
function makePlant(){
  return makeCanvas(12,12,(ctx)=>{
    ctx.fillStyle = '#166534';
    ctx.fillRect(5,7,2,5);
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(6,7);
    ctx.lineTo(2,3);
    ctx.lineTo(3,3);
    ctx.lineTo(6,6);
    ctx.lineTo(9,3);
    ctx.lineTo(10,3);
    ctx.closePath();
    ctx.fill();
  });
}

// Animal sprites -------------------------------------------------------------
function herbFrame(offset){
  return makeCanvas(16,16,(ctx)=>{
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(8,8,5,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#92400e';
    ctx.fillRect(4+offset,12,3,3);
    ctx.fillRect(9-offset,12,3,3);
  });
}
function carnFrame(offset){
  return makeCanvas(16,16,(ctx)=>{
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(8,8,5,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(4+offset,12,3,3);
    ctx.fillRect(9-offset,12,3,3);
  });
}

function rodentFrame(offset){
  return makeCanvas(16,16,(ctx)=>{
    ctx.fillStyle = '#a3a3a3';
    ctx.beginPath();
    ctx.arc(8,8,4,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#525252';
    ctx.fillRect(4+offset,12,2,2);
    ctx.fillRect(10-offset,12,2,2);
  });
}

function wolfFrame(offset){
  return makeCanvas(16,16,(ctx)=>{
    ctx.fillStyle = '#9ca3af';
    ctx.beginPath();
    ctx.arc(8,8,5,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(4+offset,12,3,3);
    ctx.fillRect(9-offset,12,3,3);
  });
}

function pollinatorFrame(offset){
  return makeCanvas(16,16,(ctx)=>{
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.arc(8,8,3,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#9333ea';
    ctx.fillRect(4+offset,12,2,2);
    ctx.fillRect(10-offset,12,2,2);
  });
}

export const sprites = {
  terrain: {
    water: texWater(),
    grass: texGrass(),
    dirt: texDirt(),
    barrier: texBarrier()
  },
  plant: makePlant(),
  herb: [herbFrame(0), herbFrame(2)],
  carn: [carnFrame(0), carnFrame(2)],
  rodent: [rodentFrame(0), rodentFrame(2)],
  wolf: [wolfFrame(0), wolfFrame(2)],
  pollinator: [pollinatorFrame(0), pollinatorFrame(2)]
};
