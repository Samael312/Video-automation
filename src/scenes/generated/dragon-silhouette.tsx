import React from 'react';

/**
 * Silueta original de dragon occidental (alas abiertas, cuernos, cola), dibujada aqui; viewBox 400x400.
 * `color` = relleno, `glow` = color del resplandor. Se usa en las escenas de tematica de fantasia.
 */
export const DragonSilhouette: React.FC<{size: number; color?: string; glow?: string; className?: string; style?: React.CSSProperties}> = ({size, color = '#120403', glow = '#ff5a1e', className, style}) => (
  <svg className={className} viewBox="0 0 400 400" width={size} height={size} style={{filter: `drop-shadow(0 0 18px ${glow}) drop-shadow(0 0 40px ${glow}88)`, overflow: 'visible', ...style}}>
    <g fill={color} stroke={glow} strokeWidth={2.5} strokeLinejoin="round">
      {/* ala izquierda */}
      <path d="M182 190 C150 150 120 120 60 92 C70 112 72 126 66 140 C52 132 36 132 22 140 C40 150 50 162 52 178 C40 176 28 180 18 190 C46 196 70 206 92 222 C116 214 150 206 182 214 Z" />
      {/* ala derecha */}
      <path d="M218 190 C250 150 280 120 340 92 C330 112 328 126 334 140 C348 132 364 132 378 140 C360 150 350 162 348 178 C360 176 372 180 382 190 C354 196 330 206 308 222 C284 214 250 206 218 214 Z" />
      {/* cola */}
      <path d="M196 270 C190 300 170 320 140 330 C118 338 104 352 108 372 C112 356 126 348 146 346 C180 342 208 320 214 284 Z" />
      <path d="M108 372 L94 360 L102 382 Z" />
      {/* cuerpo y cuello */}
      <path d="M200 120 C214 124 222 140 222 160 C232 180 236 212 230 246 C224 274 212 290 200 292 C188 290 176 274 170 246 C164 212 168 180 178 160 C178 140 186 124 200 120 Z" />
      {/* cabeza con cuernos */}
      <path d="M200 70 C214 72 222 84 220 100 C218 112 210 122 200 126 C190 122 182 112 180 100 C178 84 186 72 200 70 Z" />
      <path d="M188 78 L170 46 L194 72 Z" />
      <path d="M212 78 L230 46 L206 72 Z" />
      {/* patas */}
      <path d="M180 250 L160 282 L172 284 L186 260 Z" />
      <path d="M220 250 L240 282 L228 284 L214 260 Z" />
    </g>
    {/* ojos */}
    <circle cx={192} cy={98} r={3.5} fill="#ffcf5a" />
    <circle cx={208} cy={98} r={3.5} fill="#ffcf5a" />
  </svg>
);
