// Dynamic OG image — 1200×630
// Uses next/og with React.createElement (no JSX transform needed in edge runtime)
import { ImageResponse } from 'next/og';

export const config = { runtime: 'edge' };

export default function handler() {
  return new ImageResponse(
    {
      type: 'div',
      props: {
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
        children: [
          // Grid lines
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                inset: '0',
                backgroundImage:
                  'linear-gradient(rgba(0,220,130,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,220,130,0.03) 1px, transparent 1px)',
                backgroundSize: '52px 52px',
              },
            },
          },
          // Red doom glow top-right
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: '-150px',
                right: '-100px',
                width: '700px',
                height: '700px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(200,20,20,0.14) 0%, transparent 65%)',
              },
            },
          },
          // Green glow bottom-left
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                bottom: '-150px',
                left: '-60px',
                width: '500px',
                height: '500px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(0,220,130,0.07) 0%, transparent 65%)',
              },
            },
          },
          // TOP ROW: logo + LIVE pill
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                zIndex: '1',
              },
              children: [
                // Logo mark box
                {
                  type: 'div',
                  props: {
                    style: {
                      width: '38px',
                      height: '38px',
                      border: '2px solid #00dc82',
                      borderRadius: '7px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    },
                    children: {
                      type: 'div',
                      props: {
                        style: {
                          width: '14px',
                          height: '14px',
                          border: '2px solid #00dc82',
                          borderRadius: '50%',
                        },
                      },
                    },
                  },
                },
                // Logo text
                {
                  type: 'span',
                  props: {
                    style: {
                      fontSize: '13px',
                      fontWeight: '700',
                      letterSpacing: '0.16em',
                      color: '#00dc82',
                      fontFamily: 'monospace',
                      textTransform: 'uppercase',
                    },
                    children: 'Quantum Exposure Index',
                  },
                },
                // LIVE pill
                {
                  type: 'div',
                  props: {
                    style: {
                      marginLeft: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      border: '1.5px solid rgba(0,220,130,0.3)',
                      borderRadius: '999px',
                      padding: '4px 12px',
                      background: 'rgba(0,220,130,0.08)',
                    },
                    children: [
                      {
                        type: 'div',
                        props: {
                          style: {
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#00dc82',
                          },
                        },
                      },
                      {
                        type: 'span',
                        props: {
                          style: {
                            fontSize: '11px',
                            color: '#00dc82',
                            letterSpacing: '0.1em',
                            fontFamily: 'monospace',
                          },
                          children: 'LIVE DATA',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          // MAIN HEADLINE block
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
                zIndex: '1',
              },
              children: [
                // Eyebrow
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '13px',
                      letterSpacing: '0.24em',
                      color: 'rgba(255,60,60,0.55)',
                      fontFamily: 'monospace',
                      textTransform: 'uppercase',
                    },
                    children: '⚠  Quantum Threat Intelligence',
                  },
                },
                // Big headline
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      flexWrap: 'wrap',
                      fontSize: '76px',
                      fontWeight: '800',
                      letterSpacing: '-0.03em',
                      color: '#e8edf5',
                      lineHeight: '1.05',
                      fontFamily: 'sans-serif',
                      gap: '18px',
                    },
                    children: [
                      {
                        type: 'span',
                        props: { children: 'Is your stack' },
                      },
                      {
                        type: 'span',
                        props: {
                          style: {
                            color: '#ff2020',
                          },
                          children: 'exposed?',
                        },
                      },
                    ],
                  },
                },
                // Sub
                {
                  type: 'div',
                  props: {
                    style: {
                      fontSize: '22px',
                      color: 'rgba(232,237,245,0.45)',
                      lineHeight: '1.5',
                      maxWidth: '720px',
                      fontFamily: 'sans-serif',
                    },
                    children:
                      '330+ entities ranked by quantum vulnerability. Live risk scores, wallet scanning & countdown to Q-Day.',
                  },
                },
              ],
            },
          },
          // BOTTOM ROW: band pills + domain
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                zIndex: '1',
              },
              children: [
                // Pills row
                {
                  type: 'div',
                  props: {
                    style: { display: 'flex', gap: '10px' },
                    children: [
                      { label: 'SYSTEMIC', color: '#b400ff', bg: 'rgba(180,0,255,0.14)' },
                      { label: 'CRITICAL', color: '#dc3232', bg: 'rgba(220,50,50,0.14)' },
                      { label: 'HIGH', color: '#ff6432', bg: 'rgba(255,100,50,0.14)' },
                      { label: 'MODERATE', color: '#fab400', bg: 'rgba(250,180,0,0.14)' },
                    ].map(({ label, color, bg }) => ({
                      type: 'div',
                      props: {
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
                        children: label,
                      },
                    })),
                  },
                },
                // Domain
                {
                  type: 'span',
                  props: {
                    style: {
                      fontSize: '14px',
                      color: 'rgba(232,237,245,0.2)',
                      letterSpacing: '0.05em',
                      fontFamily: 'monospace',
                    },
                    children: 'quantum-exposure-index.vercel.app',
                  },
                },
              ],
            },
          },
        ],
      },
    },
    { width: 1200, height: 630 }
  );
}
