import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  useColorScheme,
  Dimensions,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Wallet } from 'lucide-react-native';

interface AnimatedSplashScreenProps {
  onAnimationComplete: () => void;
}

export default function AnimatedSplashScreen({
  onAnimationComplete,
}: AnimatedSplashScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const [text, setText] = useState('');
  const fullText = 'S-Pay V2';

  // Animation values
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const auraOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const cursorOpacity = useRef(new Animated.Value(1)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const containerScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Hide native splash screen immediately when our custom RN screen mounts
    SplashScreen.hideAsync().catch(() => {});

    // 2. Aura breathing loop
    const auraAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(auraOpacity, {
          toValue: 0.12,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(auraOpacity, {
          toValue: 0.05,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    auraAnimation.start();

    // 3. Cursor blinking loop
    const cursorAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    );
    cursorAnimation.start();

    // 4. Logo Spring Intro
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1.0,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // 5. Typewriter Animation (starts after logo spring intro settles)
    const typewriterTimeout = setTimeout(() => {
      let currentText = '';
      let index = 0;
      const interval = setInterval(() => {
        if (index < fullText.length) {
          currentText += fullText[index];
          setText(currentText);
          index++;
        } else {
          clearInterval(interval);
          
          // 6. Subtitle Fade In
          Animated.timing(subtitleOpacity, {
            toValue: 1,
            duration: 650,
            useNativeDriver: true,
          }).start(() => {
            // 7. Reading pause, then scale/zoom exit animation
            setTimeout(() => {
              Animated.parallel([
                Animated.timing(containerOpacity, {
                  toValue: 0,
                  duration: 450,
                  useNativeDriver: true,
                }),
                Animated.timing(containerScale, {
                  toValue: 1.06,
                  duration: 450,
                  useNativeDriver: true,
                }),
              ]).start(() => {
                cursorAnimation.stop();
                auraAnimation.stop();
                onAnimationComplete();
              });
            }, 1100);
          });
        }
      }, 110);
    }, 700);

    return () => {
      clearTimeout(typewriterTimeout);
      cursorAnimation.stop();
      auraAnimation.stop();
    };
  }, []);

  // Theme-adaptive colors
  const bgColor = isDark ? '#0b0f19' : '#f8fafc';
  const titleColor = isDark ? '#ffffff' : '#0f172a';
  const subtitleColor = isDark ? '#64748b' : '#475569';
  const logoBgColor = isDark ? 'rgba(238, 77, 45, 0.06)' : 'rgba(238, 77, 45, 0.04)';
  const logoBorderColor = isDark ? 'rgba(238, 77, 45, 0.15)' : 'rgba(238, 77, 45, 0.1)';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          opacity: containerOpacity,
          transform: [{ scale: containerScale }],
        },
      ]}
    >
      {/* Background Aura Glow */}
      <Animated.View
        style={[
          styles.glowAura,
          {
            opacity: auraOpacity,
          },
        ]}
      />

      <View style={styles.content}>
        {/* Animated Centered Logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              backgroundColor: logoBgColor,
              borderColor: logoBorderColor,
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Wallet size={48} color="#ee4d2d" strokeWidth={1.8} />
        </Animated.View>

        {/* Typewriter Title */}
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: titleColor }]}>
            {text}
            <Animated.Text
              style={[
                styles.cursor,
                {
                  opacity: cursorOpacity,
                },
              ]}
            >
              |
            </Animated.Text>
          </Text>
        </View>

        {/* Subtitle */}
        <Animated.Text
          style={[
            styles.subtitle,
            {
              color: subtitleColor,
              opacity: subtitleOpacity,
            },
          ]}
        >
          SECURE PAYMENT PLATFORM
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  glowAura: {
    position: 'absolute',
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: (width * 0.7) / 2,
    backgroundColor: '#ee4d2d',
    shadowColor: '#ee4d2d',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 80,
    elevation: 10,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 28,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#ee4d2d',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  titleContainer: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Outfit-Bold',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  cursor: {
    fontFamily: 'Outfit-Light',
    color: '#ee4d2d',
    fontWeight: '300',
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Jakarta-Bold',
    letterSpacing: 2.5,
    textAlign: 'center',
  },
});
