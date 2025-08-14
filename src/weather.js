'use strict';

import { DAY_LENGTH_SEC, WEATHER } from './worldConfig.js';

let worldTime = 0; // Segundos simulados acumulados
let simTime = 0;   // Segundos de simulación para UI
let weatherState = WEATHER.CLEAR;
let weatherTimer = 0; // Cuenta atrás del estado de clima actual

export const getWorldTime = () => worldTime;
export const setWorldTime = v => { worldTime = v; };
export const getSimTime = () => simTime;
export const setSimTime = v => { simTime = v; };
export const getWeatherState = () => weatherState;
export const setWeatherState = v => { weatherState = v; };
export const getWeatherTimer = () => weatherTimer;
export const setWeatherTimer = v => { weatherTimer = v; };

export function isNight(){
  // Noche cuando el tiempo normalizado está cerca de 0 o 1 (cuartos del día)
  const t = (worldTime % DAY_LENGTH_SEC) / DAY_LENGTH_SEC; // 0..1
  return (t < 0.25) || (t > 0.75);
}

export function daylightFactor(){
  // Factor de luz ambiental (0..1) como seno; máximo a mediodía
  const t = (worldTime % DAY_LENGTH_SEC) / DAY_LENGTH_SEC;
  return 0.35 + 0.65 * Math.max(0, Math.sin(Math.PI * (t)));
}

export function advanceWeather(dt){
  // Manejo semi-Markoviano simple: cuando expira el temporizador, elige un nuevo clima
  weatherTimer -= dt;
  if (weatherTimer <= 0){
    const r = Math.random();
    weatherState = (r < 0.55) ? WEATHER.CLEAR : (r < 0.85 ? WEATHER.RAIN : WEATHER.DROUGHT);
    // Duración base según estado con jitter aleatorio
    const base = weatherState===WEATHER.RAIN ? 18 : (weatherState===WEATHER.DROUGHT ? 20 : 24);
    const jitter = (Math.random()*0.6+0.7); // 0.7..1.3
    weatherTimer = base * jitter;
  }
}
