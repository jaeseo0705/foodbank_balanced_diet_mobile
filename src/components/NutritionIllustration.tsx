import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop, Text } from 'react-native-svg';

// Resolution-independent illustration based on the supplied login reference.
export function NutritionIllustration({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" aria-hidden>
      <Defs>
        <LinearGradient id="phone" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F5F8FA" />
          <Stop offset="1" stopColor="#EDF2F5" />
        </LinearGradient>
        <LinearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#B1BDD5" />
          <Stop offset="1" stopColor="#A6B2CB" />
        </LinearGradient>
      </Defs>
      <Ellipse cx={99} cy={121} rx={86} ry={61} fill="#F1F4F9" transform="rotate(-12 99 121)" />
      <Circle cx={169} cy={58} r={5.7} fill="#F1F4F9" />
      <Circle cx={177} cy={72} r={3.3} fill="#F1F4F9" />
      <Circle cx={30} cy={122} r={4.3} fill="#DCE3EF" />
      <Rect x={48} y={8} width={105} height={178} rx={18} fill="url(#rim)" />
      <Rect x={54} y={14} width={93} height={166} rx={13} fill="url(#phone)" />
      <Path d="M77 13h47v4a5 5 0 0 1-5 5H82a5 5 0 0 1-5-5Z" fill="#B1BDD5" />
      <Rect x={92} y={15} width={17} height={2.7} rx={1.3} fill="#FAFCFF" />
      <Path d="M74 45H64a3 3 0 0 0-3 3v9M128 45h10a3 3 0 0 1 3 3v9M62 132v8a3 3 0 0 0 3 3h9" stroke="#B3BFD8" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Rect x={66} y={55} width={70} height={80} rx={4} fill="#FFFFFF" fillOpacity={0.42} stroke="#C8D0E1" strokeWidth={0.6} />
      <Text x={101} y={70} fontSize={10.5} fontWeight="700" fill="#6C7798" textAnchor="middle">영양정보</Text>
      <G stroke="#CAD2E2" strokeWidth={0.5}>
        <Line x1={72} y1={76} x2={130} y2={76} />
        <Line x1={72} y1={89} x2={130} y2={89} />
        <Line x1={72} y1={101} x2={130} y2={101} />
        <Line x1={72} y1={113} x2={130} y2={113} />
        <Line x1={72} y1={126} x2={130} y2={126} />
      </G>
      {[82, 93.5, 106.5, 119].map((y) => (
        <G key={y} stroke="#C1CCE0" strokeWidth={2.8} strokeLinecap="round">
          <Line x1={75} y1={y} x2={90} y2={y} />
          <Line x1={114} y1={y} x2={127} y2={y} />
        </G>
      ))}
      <Line x1={59} y1={100.5} x2={143} y2={100.5} stroke="#A8C4F2" strokeWidth={1.7} strokeLinecap="round" />
      <Rect x={86} y={172} width={30} height={3} rx={1.5} fill="#B5C1D9" />
      <Path d="m156 144 16 13" stroke="#B1BDD5" strokeWidth={7.3} strokeLinecap="round" />
      <Circle cx={143} cy={127} r={21.4} fill="#F8FAFC" fillOpacity={0.94} stroke="#B1BDD5" strokeWidth={3.3} />
      <Circle cx={143} cy={127} r={18} fill="none" stroke="#DCE3EF" strokeWidth={0.7} />
      <G stroke="#DFE5EF" strokeWidth={2.8} strokeLinecap="round">
        <Line x1={133} y1={121} x2={154} y2={121} />
        <Line x1={133} y1={127} x2={150} y2={127} />
        <Line x1={133} y1={133} x2={143} y2={133} />
      </G>
    </Svg>
  );
}
