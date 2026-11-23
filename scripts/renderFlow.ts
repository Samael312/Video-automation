// Orquestador del render final (puro: toda la E/S llega en `io`, para poder probarlo).
// Pasos: validar -> preparar -> prueba -> renderizar (a un .tmp, con 1 reintento si falla el compositor)
// -> volumen final -> terminar (renombra el .tmp sobre el final). Si algo falla, el video anterior queda intacto.

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;

/** Fallo puntual del compositor de Remotion: repetir el render suele funcionar. */
export const COMPOSITOR_ERROR = /No frame found at position|Could not extract frame from compositor/i;

export type RenderIO = {
  validate(): Promise<void>;
  prepare(): Promise<void>;
  probe(): Promise<void>;
  render(tmp: string, concurrency: number): Promise<void>;
  loudness(file: string): Promise<void>;
  rename(from: string, to: string): void;
  remove(file: string): void;
  cleanResidue(): void;
  /** stdout: lo que lee la web */
  log(line: string): void;
  /** stderr: detalle tecnico */
  detail(text: string): void;
};

/** Quita colores de terminal y deja como mucho `maxLines` lineas. */
export const cleanDetail = (text: string, maxLines = 20): string =>
  String(text).replace(ANSI, '').split(/\r?\n/).filter((l) => l.trim()).slice(0, maxLines).join('\n');

const msgOf = (err: unknown) => (err instanceof Error ? err.message : String(err));
const causa = (err: unknown) => cleanDetail(msgOf(err), 1).slice(0, 200) || 'error desconocido';

class PasoFallido extends Error {
  constructor(
    readonly paso: string,
    readonly causaTxt: string,
    readonly original: unknown,
  ) {
    super(causaTxt);
  }
}

export const runRender = async (o: {final: string; tmp: string; concurrency: number}, io: RenderIO): Promise<boolean> => {
  const paso = async (nombre: string, fn: () => Promise<void> | void, prefijo = '') => {
    io.log(`== ${nombre} ==`);
    const t0 = Date.now();
    try {
      await fn();
    } catch (err) {
      throw new PasoFallido(nombre, `${prefijo}${causa(err)}`, err);
    }
    io.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  };

  // borrar el .tmp nunca debe tumbar el flujo (en Windows puede seguir bloqueado un momento)
  const quitarTmp = () => {
    try {
      io.remove(o.tmp);
    } catch (err) {
      io.log(`aviso: no se pudo borrar ${o.tmp} (${causa(err)})`);
    }
  };

  // un fallo puntual del compositor en la prueba no es un error del plan: se avisa y sigue (renderizar reintenta)
  const probar = async () => {
    try {
      await io.probe();
    } catch (err) {
      if (!COMPOSITOR_ERROR.test(msgOf(err))) throw err;
      io.log('aviso: fallo puntual del compositor en la prueba; se sigue con el render');
    }
  };

  const renderConReintento = async () => {
    quitarTmp(); // un .tmp de un render cancelado no debe estorbar
    try {
      await io.render(o.tmp, o.concurrency);
    } catch (err) {
      if (!COMPOSITOR_ERROR.test(msgOf(err))) throw err;
      const c = Math.max(1, Math.floor(o.concurrency / 2));
      // sin volcar el error: su texto confundiria a la web si despues falla otro paso
      io.log(`fallo puntual del compositor, reintento con concurrencia ${c}`);
      quitarTmp();
      await io.render(o.tmp, c);
    }
  };

  try {
    await paso('validar edit.json', () => io.validate());
    await paso('preparar', () => io.prepare());
    await paso('prueba', probar, 'el render de prueba falló: ');
    await paso('renderizar', renderConReintento);
    await paso('volumen final', () => io.loudness(o.tmp));
    await paso('terminar', () => io.rename(o.tmp, o.final));
  } catch (err) {
    const f = err instanceof PasoFallido ? err : new PasoFallido('render', causa(err), err);
    const orig = f.original;
    io.detail(cleanDetail(orig instanceof Error && orig.stack ? orig.stack : msgOf(orig)));
    // si solo fallo el renombrado, el video nuevo ya esta hecho: se conserva para no perder el render
    if (f.paso === 'terminar') io.log(`el video nuevo quedó en ${o.tmp} (cierra el video si está abierto y reintenta)`);
    else quitarTmp();
    io.log(f.causaTxt);
    io.log(`FALLO en el paso: ${f.paso}`);
    return false;
  }
  try {
    io.cleanResidue();
  } catch (err) {
    io.log(`aviso: no se pudieron borrar los temporales (${causa(err)})`);
  }
  return true;
};
