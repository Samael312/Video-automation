"""Genera efectos de sonido propios (sin derechos de autor) en public/sfx/.

Uso: python scripts/gen_sfx.py
Mono, 44100 Hz, 16 bit (igual que los sfx existentes). No sobrescribe ding/pop/swoosh/tick.
"""
import os
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sfx')
rng = np.random.default_rng(7)


def t_axis(dur):
    return np.arange(int(SR * dur)) / SR


def env_exp(n, decay):
    return np.exp(-np.arange(n) / SR * decay)


def fade(x, ms=4):
    k = int(SR * ms / 1000)
    x = x.copy()
    x[:k] *= np.linspace(0, 1, k)
    x[-k:] *= np.linspace(1, 0, k)
    return x


def lowpass(x, cutoff):
    # media movil simple, suficiente para ruido suave
    k = max(1, int(SR / cutoff))
    return np.convolve(x, np.ones(k) / k, mode='same')


def save(name, x, peak=0.8):
    x = x / (np.max(np.abs(x)) or 1) * peak
    data = (fade(x) * 32767).astype('<i2')
    with wave.open(os.path.join(OUT, f'{name}.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f'{name}.wav  {len(x) / SR:.2f}s')


def whoosh2():
    # barrido de ruido filtrado, mas corto y brillante que swoosh
    dur = 0.35
    t = t_axis(dur)
    noise = rng.standard_normal(len(t))
    sweep = np.sin(2 * np.pi * (300 * t + 2500 * t ** 2))
    x = lowpass(noise, 3000) * (0.6 + 0.4 * sweep)
    env = np.sin(np.pi * t / dur) ** 2
    save('whoosh2', x * env)


def pop2():
    # burbuja: seno que baja rapido
    t = t_axis(0.12)
    f = 900 * np.exp(-t * 18) + 250
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(len(t), 28)
    save('pop2', x)


def hit():
    # impacto grave para gancho / palabra clave
    t = t_axis(0.6)
    f = 140 * np.exp(-t * 7) + 45
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(len(t), 7)
    click = lowpass(rng.standard_normal(len(t)), 4000) * env_exp(len(t), 60) * 0.5
    save('hit', body + click)


def riser():
    # tension creciente antes de una revelacion
    dur = 1.2
    t = t_axis(dur)
    noise = lowpass(rng.standard_normal(len(t)), 5000)
    tone = np.sin(2 * np.pi * np.cumsum(200 + 1800 * (t / dur) ** 2) / SR)
    x = (0.5 * noise + 0.5 * tone) * (t / dur) ** 2
    save('riser', x)


def glitch():
    # trozos de ruido y tonos cortos entrecortados
    parts = []
    for _ in range(6):
        n = int(SR * rng.uniform(0.015, 0.04))
        if rng.random() < 0.5:
            seg = rng.standard_normal(n)
        else:
            seg = np.sin(2 * np.pi * rng.uniform(300, 2500) * np.arange(n) / SR)
        parts.append(seg * np.hanning(n))
        parts.append(np.zeros(int(SR * rng.uniform(0.005, 0.02))))
    save('glitch', np.concatenate(parts))


def message():
    # notificacion de mensaje: dos notas rapidas
    notes = []
    for f in (880, 1320):
        t = t_axis(0.09)
        notes.append(np.sin(2 * np.pi * f * t) * env_exp(len(t), 30))
    save('message', np.concatenate(notes))


def success():
    # arpegio ascendente
    notes = []
    for f in (523.25, 659.25, 783.99, 1046.5):
        t = t_axis(0.12)
        notes.append(np.sin(2 * np.pi * f * t) * env_exp(len(t), 14))
    tail = t_axis(0.35)
    notes.append(np.sin(2 * np.pi * 1046.5 * tail) * env_exp(len(tail), 8))
    save('success', np.concatenate(notes))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for fn in (whoosh2, pop2, hit, riser, glitch, message, success):
        fn()
