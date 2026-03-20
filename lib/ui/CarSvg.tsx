import Svg, { Rect, Ellipse, Path, G } from 'react-native-svg';
import { COLORS } from '../shared';

type Props = {
  width?: number;
  height?: number;
  color?: string;
};

export default function CarSvg({ width = 100, height = 48, color = COLORS.primary }: Props) {
  const w = width;
  const h = height;
  const s = w / 100; // scale factor

  return (
    <Svg width={w} height={h} viewBox="0 0 100 48">
      {/* Shadow */}
      <Ellipse cx={50} cy={45} rx={38} ry={4} fill="rgba(0,0,0,0.12)" />

      {/* Body */}
      <Rect x={6} y={22} width={88} height={20} rx={6} fill={color} />

      {/* Cabin roof */}
      <Path
        d="M28 22 C30 10, 38 8, 46 8 L60 8 C68 8, 74 10, 76 22 Z"
        fill={color}
      />

      {/* Windshield front */}
      <Path
        d="M62 22 C65 13, 70 10, 74 11 L76 22 Z"
        fill="rgba(255,255,255,0.18)"
      />

      {/* Window cabin */}
      <Path
        d="M31 22 C32 13, 37 9, 44 9 L60 9 C64 9, 68 12, 70 22 Z"
        fill="rgba(255,255,255,0.15)"
      />

      {/* Windshield back */}
      <Path
        d="M28 22 C27 14, 30 10, 34 10 L32 22 Z"
        fill="rgba(255,255,255,0.18)"
      />

      {/* Front bumper detail */}
      <Rect x={88} y={28} width={6} height={8} rx={2} fill={color} />
      {/* Headlight front */}
      <Ellipse cx={91} cy={29} rx={3} ry={2} fill="#FAB81F" opacity={0.9} />

      {/* Rear bumper detail */}
      <Rect x={6} y={28} width={6} height={8} rx={2} fill={color} />
      {/* Taillight rear */}
      <Ellipse cx={9} cy={29} rx={3} ry={2} fill="#E74C3C" opacity={0.85} />

      {/* Wheel back */}
      <Ellipse cx={24} cy={42} rx={9} ry={9} fill="#1a1a2e" />
      <Ellipse cx={24} cy={42} rx={5} ry={5} fill="#333" />
      <Ellipse cx={24} cy={42} rx={2} ry={2} fill="#888" />

      {/* Wheel front */}
      <Ellipse cx={76} cy={42} rx={9} ry={9} fill="#1a1a2e" />
      <Ellipse cx={76} cy={42} rx={5} ry={5} fill="#333" />
      <Ellipse cx={76} cy={42} rx={2} ry={2} fill="#888" />

      {/* Door line */}
      <Rect x={46} y={22} width={1} height={18} rx={0.5} fill="rgba(255,255,255,0.2)" />

      {/* Door handle front */}
      <Rect x={58} y={30} width={8} height={2.5} rx={1.2} fill="rgba(255,255,255,0.3)" />
      {/* Door handle back */}
      <Rect x={32} y={30} width={8} height={2.5} rx={1.2} fill="rgba(255,255,255,0.3)" />
    </Svg>
  );
}
