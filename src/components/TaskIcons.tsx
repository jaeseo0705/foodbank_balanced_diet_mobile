import { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

export type TaskId = 'nutrition-registration' | 'inventory' | 'distribution' | 'nutrition-calculation';

export function ProfileAvatar({ size = 40 }: { size?: number }) {
  const clipId = 'avatar-' + useId().replace(/:/g, '');
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <Defs>
        <ClipPath id={clipId}><Circle cx={32} cy={32} r={29} /></ClipPath>
      </Defs>
      <Circle cx={32} cy={32} r={29} fill={colors.avatarBackground} />
      <G clipPath={`url(#${clipId})`} fill={colors.avatarPerson}>
        <Circle cx={32} cy={24} r={10.5} />
        <Path d="M8 64C8 45 17 36 32 36S56 45 56 64Z" />
      </G>
      <Circle cx={32} cy={32} r={29} fill="none" stroke={colors.avatarBorder} strokeWidth={1.8} />
    </Svg>
  );
}

function RegistrationDrawing() {
  return (
    <>
      <Path d="M28 12H15v15M100 12h13v15M15 97v15h13M113 97v15h-13" />
      <Rect x={30} y={23} width={68} height={76} rx={8} />
      <Line x1={41} y1={38} x2={86} y2={38} strokeWidth={4} />
      <Line x1={41} y1={51} x2={87} y2={51} strokeWidth={2.3} />
      {[62, 73, 84].map((y) => (
        <G key={y} strokeWidth={2}>
          <Line x1={41} y1={y} x2={60} y2={y} />
          <Circle cx={78} cy={y} r={0.7} fill={colors.primary} />
          <Circle cx={83} cy={y} r={0.7} fill={colors.primary} />
          <Circle cx={88} cy={y} r={0.7} fill={colors.primary} />
        </G>
      ))}
      <Line x1={41} y1={91} x2={86} y2={91} strokeWidth={2} />
    </>
  );
}

function InventoryDrawing() {
  return (
    <>
      <Rect x={9} y={63} width={38} height={35} rx={5} />
      <Path d="M23 63v10h10V63" strokeWidth={2.8} />
      <Rect x={49} y={63} width={38} height={35} rx={5} />
      <Path d="M63 63v10h10V63" strokeWidth={2.8} />
      <Rect x={29} y={27} width={40} height={35} rx={5} />
      <Path d="M44 27v10h10V27" strokeWidth={2.8} />
      <Rect x={88} y={49} width={33} height={49} rx={5} />
      {[62, 75, 88].map((y) => (
        <G key={y} strokeWidth={2.8}>
          <Path d={`M94 ${y}l3 3 5-6`} />
          <Line x1={108} y1={y} x2={115} y2={y} />
        </G>
      ))}
    </>
  );
}

function DistributionDrawing() {
  return (
    <>
      <Path d="M38 63C26 66 22 51 27 42c4-7 12-8 18-3 5-4 13-5 17 1 5 7 1 20-5 25" />
      <Path d="M44 39c0-8-2-12-6-15M44 34c9 0 13-5 14-11-8 0-13 4-14 11" />
      <Path d="M65 63V35l8-13h20l9 13v25M65 35h37M73 22V14h20v8M85 36v25" />
      <Path d="m17 62 45 13 44-13 13 16-43 15-14-18-14 18L5 78ZM17 84v25l45 14 44-14V84M62 96v27" />
      <Path d="M106 8c1 7 4 10 10 11-6 2-9 5-10 11-2-6-5-9-11-11 6-1 9-4 11-11Z" strokeWidth={2.6} />
    </>
  );
}

function CalculationDrawing() {
  return (
    <>
      <Path d="M73 111H28a9 9 0 0 1-9-9V24a9 9 0 0 1 9-9h57a9 9 0 0 1 9 9v42" />
      <Rect x={30} y={27} width={53} height={21} rx={3} />
      {[59, 76, 93].map((y) => (
        <G key={y}>
          <Rect x={31} y={y} width={9} height={9} rx={1.6} />
          <Rect x={49} y={y} width={9} height={9} rx={1.6} />
          {y === 59 && <Rect x={67} y={y} width={9} height={9} rx={1.6} />}
        </G>
      ))}
      <Path d="M80 103c-10-13-3-33 33-32 2 32-16 43-33 32Z" />
      <Path d="m75 116 28-31" />
    </>
  );
}

export function TaskIcon({ task, size }: { task: TaskId; size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 128 128" aria-hidden>
      <G fill="none" stroke={colors.primary} strokeWidth={3.3} strokeLinecap="round" strokeLinejoin="round">
        {task === 'nutrition-registration' && <RegistrationDrawing />}
        {task === 'inventory' && <InventoryDrawing />}
        {task === 'distribution' && <DistributionDrawing />}
        {task === 'nutrition-calculation' && <CalculationDrawing />}
      </G>
    </Svg>
  );
}

export function BackIcon() {
  return (
    <Svg width={23} height={23} viewBox="0 0 24 24" aria-hidden>
      <Path d="m15 5-7 7 7 7" fill="none" stroke={colors.primary} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
