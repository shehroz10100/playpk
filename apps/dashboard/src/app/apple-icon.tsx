import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0B1F3A',
          fontSize: 64,
          fontWeight: 800,
          fontFamily: 'sans-serif',
          letterSpacing: -1,
        }}
      >
        <span style={{ color: '#FFFFFF' }}>Play</span>
        <span style={{ color: '#00A651' }}>PK</span>
      </div>
    ),
    { ...size },
  );
}
