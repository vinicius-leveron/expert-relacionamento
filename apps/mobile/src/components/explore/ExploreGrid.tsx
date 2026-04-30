import { View, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { ExploreCard } from './ExploreCard';
import type { ExploreCategory } from '@/data/explore-categories';
import { spacing } from '@/theme';

const GAP = 12;
const PADDING = 16;
const MIN_CARD_WIDTH = 150;
const MAX_CARD_WIDTH = 220;
const ASPECT_RATIO = 1.25; // height = width * 1.25

function getGridConfig(screenWidth: number) {
  const availableWidth = screenWidth - PADDING * 2;

  // Calculate optimal number of columns
  let numColumns = Math.floor(availableWidth / MIN_CARD_WIDTH);
  numColumns = Math.max(2, Math.min(numColumns, 4)); // Between 2 and 4 columns

  // Calculate card width with gaps
  const totalGap = GAP * (numColumns - 1);
  let cardWidth = (availableWidth - totalGap) / numColumns;

  // Cap card width for large screens
  if (cardWidth > MAX_CARD_WIDTH) {
    cardWidth = MAX_CARD_WIDTH;
  }

  const cardHeight = cardWidth * ASPECT_RATIO;

  return { numColumns, cardWidth, cardHeight };
}

interface ExploreGridProps {
  categories: ExploreCategory[];
  onSelectCategory: (category: ExploreCategory) => void;
}

export function ExploreGrid({
  categories,
  onSelectCategory,
}: ExploreGridProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { cardWidth, cardHeight } = getGridConfig(screenWidth);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.grid}>
        {categories.map((item) => (
          <ExploreCard
            key={item.id}
            title={item.title}
            gradient={item.gradient}
            activeUsers={item.activeUsers}
            onPress={() => onSelectCategory(item)}
            width={cardWidth}
            height={cardHeight}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: PADDING,
    paddingBottom: spacing.xxl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    justifyContent: 'center',
  },
});
