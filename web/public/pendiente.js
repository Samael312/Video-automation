// Archivo elegido en "Editar video" / "Audio a video": el asistente lo sube al abrirse (una sola vez).
let pendiente = null; // {plan, nombre, file}

export const ponerPendiente = (p) => {
  pendiente = p;
};

/** Devuelve el archivo si es para este video y lo olvida; si no, null. */
export const tomarPendiente = (plan, nombre) => {
  if (!pendiente || pendiente.plan !== plan || pendiente.nombre !== nombre) return null;
  const f = pendiente.file;
  pendiente = null;
  return f;
};
