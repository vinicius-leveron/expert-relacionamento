import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WelcomeSlide, PaginationDots } from '@/components/onboarding';
import { colors, spacing, typography, radius } from '@/theme';
import { captureAnalyticsEvent } from '@/analytics/posthog';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    icon: 'heart-circle' as const,
    title: 'Descubra seu perfil',
    description: 'Entenda seus padrões de relacionamento com um diagnóstico rápido.',
  },
  {
    id: '2',
    icon: 'chatbubbles' as const,
    title: 'Orientação personalizada',
    description: 'Receba conselhos da Isabela, sua coach de relacionamentos.',
  },
  {
    id: '3',
    icon: 'calendar' as const,
    title: 'Evolua em 30 dias',
    description: 'Uma jornada com exercícios práticos para transformar seus relacionamentos.',
  },
];

export default function WelcomeScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const isLastSlide = currentIndex === slides.length - 1;

  useEffect(() => {
    captureAnalyticsEvent('onboarding_welcome_viewed');
  }, []);

  const handleNext = () => {
    captureAnalyticsEvent(isLastSlide ? 'onboarding_completed' : 'onboarding_next_clicked', {
      step: currentIndex + 1,
    });
    if (isLastSlide) {
      router.replace('/login');
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    }
  };

  const handleSkip = () => {
    captureAnalyticsEvent('onboarding_skipped', {
      step: currentIndex + 1,
    });
    router.replace('/login');
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems[0]?.index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  return (
    <View style={styles.container}>
      {/* Skip button */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Pular</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={({ item }) => (
          <WelcomeSlide
            icon={item.icon}
            title={item.title}
            description={item.description}
          />
        )}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />

      {/* Bottom controls */}
      <View style={styles.bottomContainer}>
        <PaginationDots total={slides.length} current={currentIndex} />

        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {isLastSlide ? 'Começar' : 'Próximo'}
          </Text>
          <Ionicons
            name={isLastSlide ? 'checkmark' : 'arrow-forward'}
            size={20}
            color={colors.white}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: spacing.lg,
    zIndex: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  skipText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontFamily: 'Inter_500Medium',
  },
  bottomContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 50,
    gap: spacing.xl,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  nextButtonText: {
    ...typography.button,
    color: colors.white,
    fontFamily: 'Inter_600SemiBold',
  },
});
