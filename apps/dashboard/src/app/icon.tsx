import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: 8,
          color: '#00A651',
          fontSize: 18,
          fontWeight: 800,
          fontFamily: 'sans-serif',
        }}
      >
        PK
      </div>
    ),
    { ...size },
  );
}
