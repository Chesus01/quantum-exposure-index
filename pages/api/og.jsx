// Dynamic OG image for social sharing — 1200×630
// Uses next/og (built into Next.js 14, no extra package needed)
// Edge runtime: fast, no cold starts

import { ImageResponse } from 'next/og';

export const config = { runtime: 'edge' };

export default function handler() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          background: '#070a0f',
          padding: '64px 72px',
          fontFamily: 'monospace',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(0,220,130,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,220,130,0.025) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
          }}
        />

        {/* Red radial glow — doom energy */}
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            right: '-10%',
            width: '700px',
            height: '700px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(200,20,20,0.12) 0%, transparent 65%)',
          }}
        />

        {/* Green glow bottom-left */}
        <div
          style={{
            position: 'absolute',
            bottom: '-20%',
            left: '-5%',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,220,130,0.08) 0%, transparent 65%)',
          }}
        />

        {/* TOP ROW: Logo + Live pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', zIndex: 1 }}>
          {/* Logo mark */}
          <div
            style={{
              width: '38px',
              height: '38px',
              border: '2px solid #00dc82',
              borderRadius: '7px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '14px',
                height: '14px',
                border: '2px solid #00dc82',
                borderRadius: '50%',
              }}
            />
          </div>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.16em',
              color: '#00dc82',
              textTransform: 'uppercase',
            }}
          >
            Quantum Exposure Index
          </span>
          <div
            style={{
              marginLeft: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: '1.5px solid rgba(0,220,130,0.3)',
              borderRadius: '999px',
              padding: '4px 12px',
              background: 'rgba(0,220,130,0.08)',
            }}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#00dc82',
              }}
            />
            <span style={{ fontSize: '11px', color: '#00dc82', letterSpacing: '0.1em' }}>
              LIVE DATA
            </span>
          </div>
        </div>

        {/* MAIN HEADLINE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', zIndex: 1 }}>
          <div
            style={{
              fontSize: '9px',
              letterSpacing: '0.28em',
              color: 'rgba(255,60,60,0.55)',
              textTransform: 'uppercase',
            }}
          >
            ⚠ Quantum Threat Intelligence
          </div>
          <div
            style={{
              fontSize: '72px',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#e8edf5',
              lineHeight: 1.05,
              fontFamily: 'sans-serif',
            }}
          >
            Is your stack{' '}
            <span style={{ color: '#ff2020', textShadow: '0 0 40px rgba(255,30,30,0.5)' }}>
              exposed?
            </span>
          </div>
          <div
            style={{
              fontSize: '22px',
              color: 'rgba(232,237,245,0.5)',
              lineHeight: 1.5,
              maxWidth: '700px',
            }}
          >
            330+ entities ranked by quantum vulnerability. Live risk scores, wallet scanning &amp;
            a countdown to Q-Day.
          </div>
        </div>

        {/* BOTTOM ROW: Risk band pills + domain */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', gap: '10px' }}>
            {[
              { label: 'SYSTEMIC', color: '#b400ff', bg: 'rgba(180,0,255,0.12)' },
              { label: 'CRITICAL', color: '#dc3232', bg: 'rgba(220,50,50,0.12)' },
              { label: 'HIGH', color: '#ff6432', bg: 'rgba(255,100,50,0.12)' },
              { label: 'MODERATE', color: '#fab400', bg: 'rgba(250,180,0,0.12)' },
            ].map(({ label, color, bg }) => (
              <div
                key={label}
                style={{
                  padding: '5px 14px',
                  borderRadius: '4px',
                  background: bg,
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color,
                }}
              >
                {label}
              </div>
            ))}
          </div>
          <span
            style={{
              fontSize: '13px',
              color: 'rgba(232,237,245,0.25)',
              letterSpacing: '0.05em',
            }}
          >
            quantum-exposure-index.vercel.app
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
