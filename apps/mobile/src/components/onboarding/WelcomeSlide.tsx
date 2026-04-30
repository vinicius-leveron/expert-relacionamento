import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/theme';

const { width } = Dimensions.get('window');

interface WelcomeSlideProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

export function WelcomeSlide({ icon, title, description }: WelcomeSlideProps) {
  return (
    <View style={styles.container}>
      <View style={styles.illustrationArea}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={64} color={colors.primary} />
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  illustrationArea: {
    flex: 0.6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 0.4,
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  title: {
    ...typography.display,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontFamily: 'Inter_700Bold',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    fontFamily: 'Inter_400Regular',
  },
});
