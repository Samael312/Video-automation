// Uso: npm run inspect -- <video>
// Imprime la transcripcion con tiempos ORIGINALES por tramo conservado y las zonas cortadas.
// Los tiempos de edit.json se eligen de aqui.
import {formatInspect} from '../src/lib/inspect';
import {loadTranscriptAndKeeps, resolveVideo} from './common';

const {name} = resolveVideo(process.argv[2], 'npm run inspect -- <video>');
const {transcript, keeps} = loadTranscriptAndKeeps(name);
console.log(`# ${name} (tiempos del video original; usalos tal cual en edit.json)\n`);
console.log(formatInspect(transcript, keeps));
