import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { COLORS } from '@aerocab/shared';

const { width } = Dimensions.get('window');

type Props = {
  onFinish: () => void;
  appName?: string;
  tagline?: string;
};

export default function SplashScreen({
  onFinish,
  appName,
  tagline = "Votre chauffeur de confiance\nvous attend a l'aeroport",
}: Props) {
  // Animation values
  const bgOpacity = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(-15)).current;
  const wingTranslateX = useRef(new Animated.Value(-40)).current;
  const wingOpacity = useRef(new Animated.Value(0)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandTranslateY = useRef(new Animated.Value(20)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(15)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;
  const dotScale1 = useRef(new Animated.Value(0)).current;
  const dotScale2 = useRef(new Animated.Value(0)).current;
  const dotScale3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Phase 1: Logo appears with bounce + rotation
    const phase1 = Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(logoRotate, {
        toValue: 0,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]);

    // Phase 2: Wing flies in from left
    const phase2 = Animated.parallel([
      Animated.spring(wingTranslateX, {
        toValue: 0,
        friction: 5,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(wingOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]);

    // Phase 3: Brand name fades in from bottom
    const phase3 = Animated.parallel([
      Animated.timing(brandOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(brandTranslateY, {
        toValue: 0,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
    ]);

    // Phase 4: Tagline + decorative line
    const phase4 = Animated.parallel([
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(taglineTranslateY, {
        toValue: 0,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(lineWidth, {
        toValue: 1,
        duration: 600,
        useNativeDriver: false,
      }),
    ]);

    // Phase 5: Loading dots sequence
    const phase5 = Animated.stagger(150, [
      Animated.spring(dotScale1, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
      Animated.spring(dotScale2, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
      Animated.spring(dotScale3, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
    ]);

    // Phase 6: Pulse logo then exit
    const phase6 = Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.15,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(pulseAnim, {
        toValue: 1,
        friction: 3,
        tension: 80,
        useNativeDriver: true,
      }),
    ]);

    // Run the sequence
    Animated.sequence([
      Animated.delay(200),
      phase1,
      Animated.delay(100),
      phase2,
      Animated.delay(100),
      phase3,
      Animated.delay(80),
      phase4,
      Animated.delay(200),
      phase5,
      Animated.delay(400),
      phase6,
      Animated.delay(300),
    ]).start(() => {
      onFinish();
    });
  }, []);

  const rotateInterpolation = logoRotate.interpolate({
    inputRange: [-15, 0],
    outputRange: ['-15deg', '0deg'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: bgOpacity }]}>
      {/* Decorative background circles */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />
      <View style={styles.bgCircle3} />

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            opacity: logoOpacity,
            transform: [
              { scale: Animated.multiply(logoScale, pulseAnim) },
              { rotate: rotateInterpolation },
            ],
          },
        ]}
      >
        <View style={styles.logoOuter}>
          <View style={styles.logoInner}>
            {/* Plane icon */}
            <Animated.Text
              style={[
                styles.planeIcon,
                {
                  opacity: wingOpacity,
                  transform: [{ translateX: wingTranslateX }],
                },
              ]}
            >
              {'\u2708'}
            </Animated.Text>
          </View>
        </View>
      </Animated.View>

      {/* Brand name */}
      <Animated.View
        style={{
          opacity: brandOpacity,
          transform: [{ translateY: brandTranslateY }],
        }}
      >
        <Text style={styles.brandName}>
          Aero<Text style={styles.brandAccent}>Cab</Text>
        </Text>
        {appName ? (
          <Text style={styles.brandSuffix}>{appName}</Text>
        ) : (
          <Text style={styles.brandSuffix}>Connect</Text>
        )}
      </Animated.View>

      {/* Decorative line */}
      <Animated.View
        style={[
          styles.decorLine,
          {
            width: lineWidth.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 60],
            }),
          },
        ]}
      />

      {/* Tagline */}
      <Animated.Text
        style={[
          styles.tagline,
          {
            opacity: taglineOpacity,
            transform: [{ translateY: taglineTranslateY }],
          },
        ]}
      >
        {tagline}
      </Animated.Text>

      {/* Loading dots */}
      <View style={styles.dotsRow}>
        {[dotScale1, dotScale2, dotScale3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              { transform: [{ scale: dot }] },
            ]}
          />
        ))}
      </View>

      {/* Footer */}
      <Animated.Text style={[styles.footer, { opacity: taglineOpacity }]}>
        Cameroun {'\u2022'} Douala {'\u2022'} Yaounde
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bgCircle1: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width * 0.75,
    backgroundColor: 'rgba(255,255,255,0.02)',
    top: -width * 0.5,
    left: -width * 0.25,
  },
  bgCircle2: {
    position: 'absolute',
    width: width,
    height: width,
    borderRadius: width * 0.5,
    backgroundColor: 'rgba(250,184,31,0.04)',
    bottom: -width * 0.3,
    right: -width * 0.2,
  },
  bgCircle3: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.015)',
    top: '20%',
    right: -60,
  },
  logoWrapper: {
    marginBottom: 24,
  },
  logoOuter: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  logoInner: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planeIcon: {
    fontSize: 44,
    color: COLORS.primaryDark,
  },
  brandName: {
    fontSize: 36,
    fontWeight: '800',
    color: COLORS.white,
    textAlign: 'center',
    letterSpacing: -1,
  },
  brandAccent: {
    color: COLORS.accent,
  },
  brandSuffix: {
    fontSize: 18,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    letterSpacing: 6,
    marginTop: 2,
  },
  decorLine: {
    height: 3,
    backgroundColor: COLORS.accent,
    borderRadius: 2,
    marginVertical: 20,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  dotsRow: {
    flexDirection: 'row',
    marginTop: 40,
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  footer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
