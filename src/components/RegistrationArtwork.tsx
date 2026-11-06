import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

export function RegistrationArtwork({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 280 280" aria-hidden>
      <Ellipse cx={139} cy={146} rx={116} ry={78} fill={colors.avatarBackground} opacity={0.65} transform="rotate(-12 139 146)" />
      <Ellipse cx={140} cy={261} rx={75} ry={7} fill={colors.avatarBorder} opacity={0.42} />
      <Path d="M62 20H44v18M218 20h18v18M44 220v18h18M236 220v18h-18" fill="none" stroke={colors.primary} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      <Rect x={78} y={29} width={124} height={212} rx={25} fill={colors.avatarBackground} stroke={colors.primary} strokeWidth={3} />
      <Rect x={82} y={54} width={116} height={158} fill={colors.cardTop} />
      <Line x1={128} y1={42} x2={152} y2={42} stroke={colors.primary} strokeWidth={3.5} strokeLinecap="round" />
      <Circle cx={140} cy={225} r={8} fill="none" stroke={colors.avatarBorder} strokeWidth={3} />
      <Rect x={91} y={74} width={98} height={125} rx={5} fill={colors.cardTop} stroke={colors.primary} strokeWidth={1.3} />
      <SvgText x={140} y={95} textAnchor="middle" fontSize={12} fontWeight="400" fill="#A5B2CB">영양정보</SvgText>
      <Line x1={100} y1={108} x2={180} y2={108} stroke={colors.primary} strokeWidth={1.8} strokeLinecap="round" />
      {[122, 143, 164, 185].map((y, index) => (
        <G key={y}>
          <Line x1={101} y1={y} x2={index % 2 ? 125 : 134} y2={y} stroke={colors.avatarPerson} strokeWidth={4} strokeLinecap="round" opacity={0.72} />
          <Line x1={166} y1={y} x2={178} y2={y} stroke={colors.avatarPerson} strokeWidth={4} strokeLinecap="round" opacity={0.72} />
          {index < 3 && <Line x1={100} y1={y + 10} x2={180} y2={y + 10} stroke={colors.avatarBorder} strokeWidth={1.2} />}
        </G>
      ))}
    </Svg>
  );
}

export type RegistrationMethod = 'camera' | 'photo' | 'manual';

export function RegistrationActionIcon({ method, color }: { method: RegistrationMethod; color: string }) {
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32" aria-hidden>
      <G fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        {method === 'camera' && <>
          <Path d="M11 7 13 3h6l2 4h5a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3Z" />
          <Circle cx={16} cy={17} r={6} />
        </>}
        {method === 'photo' && <>
          <Rect x={3} y={4} width={26} height={24} rx={3} />
          <Circle cx={22} cy={11} r={2.5} />
          <Path d="m4 23 8-9 7 7 4-4 5 6" />
        </>}
        {method === 'manual' && <>
          <Path d="m5 21 16-16a3 3 0 0 1 4 0l2 2a3 3 0 0 1 0 4L11 27l-8 2ZM19 7l6 6M5 21l6 6" />
        </>}
      </G>
    </Svg>
  );
}
