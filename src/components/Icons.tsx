import Svg, { Circle, Path } from 'react-native-svg';

export function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <Svg width={27} height={27} viewBox="0 0 28 28" aria-hidden>
      <Path
        d="M2 14C5.1 8.8 9.1 6.3 14 6.3S22.9 8.8 26 14C22.9 19.2 18.9 21.7 14 21.7S5.1 19.2 2 14Z"
        fill="none"
        stroke="#8D93B5"
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Circle cx={14} cy={14} r={3.7} fill="none" stroke="#8D93B5" strokeWidth={1.9} />
      {visible && <Path d="M4 3.5 24 24.5" stroke="#8D93B5" strokeWidth={1.9} strokeLinecap="round" />}
    </Svg>
  );
}

export function CheckIcon() {
  return (
    <Svg width={17} height={17} viewBox="0 0 20 20" aria-hidden>
      <Path d="m4 10 4 4 8-9" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
