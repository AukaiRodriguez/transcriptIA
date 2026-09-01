// Nivela el volumen de la señal de audio antes de transcribirla: un
// DynamicsCompressorNode reduce el rango dinámico (sube lo callado, limita lo
// fuerte para que no se distorsione) y un GainNode aplica un realce adicional
// por encima. Es la combinación estándar para hacer que un micrófono "capte
// más" sin depender solo del autoGainControl nativo del navegador (que suele
// ser bastante conservador).
//
// @param {AudioContext} audioContext
// @param {AudioNode} sourceNode - nodo de entrada (ej. MediaStreamAudioSourceNode)
// @param {{ gain?: number }} options - `gain` es el realce lineal aplicado
//   después del compresor (1 = sin cambio, 2 = el doble de fuerte). Valores muy
//   altos pueden introducir ruido de fondo audible junto con la voz.
// @returns {AudioNode} el nodo de salida de la cadena, listo para conectar
//   a donde se necesite (un ScriptProcessorNode, un MediaStreamDestination, etc.)
export function createVoiceBoostChain(audioContext, sourceNode, { gain = 1.8 } = {}) {
  const compressor = audioContext.createDynamicsCompressor();
  // Umbral bajo + ratio alto: empieza a comprimir desde niveles de voz débil/
  // lejana, nivelando fuerte la diferencia entre "susurro" y "voz normal".
  compressor.threshold.setValueAtTime(-55, audioContext.currentTime);
  compressor.knee.setValueAtTime(30, audioContext.currentTime);
  compressor.ratio.setValueAtTime(14, audioContext.currentTime);
  compressor.attack.setValueAtTime(0.003, audioContext.currentTime);
  compressor.release.setValueAtTime(0.25, audioContext.currentTime);

  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(gain, audioContext.currentTime);

  sourceNode.connect(compressor);
  compressor.connect(gainNode);
  return gainNode;
}
