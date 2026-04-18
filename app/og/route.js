import { ImageResponse } from 'next/og';
import React from 'react';

export const runtime = 'edge';

export async function GET() {
  const e = React.createElement;

  const pill = (label, color, bg) =>
    e('div', {
      key: label,
      style: {
        padding: '6px 16px',
        borderRadius: '4px',
        background: bg,
        fontSize: '12px',
        fontWeight: '700',
        letterSpacing: '0.08em',
        color,
        fontFamily: 'monospace',
      },
    }, label);

  return new ImageResponse(
    e('div', {
      style: {
        width: '1200px',
        height: '630px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        background: '#070a0f',
        padding: '64px 72px',
        position: 'relative',
        overflow: 'hidden',
      },
    },
      // Red glow top-right
      e('div', {
        style: {
          position: 'absolute', top: '-150px', right: '-100px',
          width: '700px', height: '700px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(200,20,20,0.16) 0%, transparent 65%)',
        },
      }),
      // Green glow bottom-left
      e('div', {
        style: {
          position: 'absolute', bottom: '-150px', left: '-60px',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,220,130,0.08) 0%, transparent 65%)',
        },
      }),
      // TOP ROW
      e('div', { style: { display: 'flex', alignItems: 'center', gap: '14px' } },
        e('div', {
          style: {
            width: '38px', height: '38px',
            border: '2px solid #00dc82', borderRadius: '7px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
        },
          e('div', { style: { width: '14px', height: '14px', border: '2px solid #00dc82', borderRadius: '50%' } })
        ),
        e('span', {
          style: {
            fontSize: '14px', fontWeight: '700', letterSpacing: '0.16em',
            color: '#00dc82', fontFamily: 'monospace', textTransform: 'uppercase',
          },
        }, 'Quantum Exposure Index'),
        e('div', {
          style: {
            marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '6px',
            border: '1.5px solid rgba(0,220,130,0.3)', borderRadius: '999px',
            padding: '4px 12px', background: 'rgba(0,220,130,0.08)',
          },
        },
          e('div', { style: { width: '7px', height: '7px', borderRadius: '50%', background: '#00dc82' } }),
          e('span', { style: { fontSize: '11px', color: '#00dc82', letterSpacing: '0.1em', fontFamily: 'monospace' } }, 'LIVE DATA'),
        ),
      ),
      // HEADLINE
      e('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px' } },
        e('div', {
          style: {
            fontSize: '13px', letterSpacing: '0.24em',
            color: 'rgba(255,60,60,0.6)', fontFamily: 'monospace', textTransform: 'uppercase',
          },
        }, '\u26a0  Quantum Threat Intelligence'),
        e('div', { style: { display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'baseline' } },
          e('span', {
            style: {
              fontSize: '76px', fontWeight: '800', letterSpacing: '-0.03em',
              color: '#e8edf5', lineHeight: '1', fontFamily: 'sans-serif',
            },
          }, 'Is your stack'),
          e('span', {
            style: {
              fontSize: '76px', fontWeight: '800', letterSpacing: '-0.03em',
              color: '#ff2020', lineHeight: '1', fontFamily: 'sans-serif',
            },
          }, 'exposed?'),
        ),
        e('div', {
          style: {
            fontSize: '22px', color: 'rgba(232,237,245,0.45)',
            lineHeight: '1.5', maxWidth: '740px', fontFamily: 'sans-serif',
          },
        }, '330+ entities ranked by quantum vulnerability. Live risk scores, wallet scanning & countdown to Q-Day.'),
      ),
      // BOTTOM ROW
      e('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' } },
        e('div', { style: { display: 'flex', gap: '10px' } },
          pill('SYSTEMIC', '#b400ff', 'rgba(180,0,255,0.14)'),
          pill('CRITICAL', '#dc3232', 'rgba(220,50,50,0.14)'),
          pill('HIGH', '#ff6432', 'rgba(255,100,50,0.14)'),
          pill('MODERATE', '#fab400', 'rgba(250,180,0,0.14)'),
        ),
        e('span', {
          style: { fontSize: '14px', color: 'rgba(232,237,245,0.2)', letterSpacing: '0.05em', fontFamily: 'monospace' },
        }, 'quantum-exposure-index.vercel.app'),
      ),
    ),
    { width: 1200, height: 630 }
  );
}
