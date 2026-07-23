import {
  featuredSportsForRail,
  orderSportsForRail,
  resolveSportCover,
  type SportDto,
} from '@playpk/shared-types';
import {
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors } from '../lib/theme';

type Props = {
  sports: SportDto[];
  selected: string;
  onSelect: (sportName: string) => void;
  /** When true, only show Cricket→Gym; otherwise featured first then others. */
  featuredOnly?: boolean;
  showAll?: boolean;
};

function CoverOverlay({ active }: { active: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.overlayBase, active ? styles.overlayActive : styles.overlayIdle]}
    />
  );
}

export function SportFilterRail({
  sports,
  selected,
  onSelect,
  featuredOnly = false,
  showAll = true,
}: Props) {
  const { width } = useWindowDimensions();
  const isCompact = width < 400;
  const isWide = width >= 900;
  const chipW = isWide
    ? 104
    : isCompact
      ? Math.max(68, Math.round(width * 0.18))
      : Math.min(92, Math.max(76, Math.round(width * 0.19)));
  const chipH = Math.round(chipW * 1.78);
  const items = featuredOnly ? featuredSportsForRail(sports) : orderSportsForRail(sports);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={chipW + 10}
      snapToAlignment="start"
      contentContainerStyle={[
        styles.row,
        { paddingHorizontal: isCompact ? 12 : 16, gap: isCompact ? 8 : 10 },
      ]}
    >
      {showAll ? (
        <Pressable
          onPress={() => onSelect('')}
          accessibilityRole="button"
          accessibilityState={{ selected: !selected }}
          style={({ pressed }) => [
            { width: chipW, height: chipH },
            pressed && styles.pressed,
          ]}
        >
          <ImageBackground
            source={{ uri: resolveSportCover('All', null, 'rail') }}
            style={[styles.chip, !selected && styles.chipActive]}
            imageStyle={styles.chipImage}
          >
            <CoverOverlay active={!selected} />
            <Text
              numberOfLines={2}
              style={[
                styles.label,
                !selected && styles.labelActive,
                { fontSize: isCompact ? 11 : 12 },
              ]}
            >
              All sports
            </Text>
          </ImageBackground>
        </Pressable>
      ) : null}

      {items.map((s) => {
        const active = selected === s.name;
        return (
          <Pressable
            key={s.id}
            onPress={() => onSelect(s.name)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              { width: chipW, height: chipH },
              pressed && styles.pressed,
            ]}
          >
            <ImageBackground
              source={{ uri: resolveSportCover(s.name, null, 'rail') }}
              style={[styles.chip, active && styles.chipActive]}
              imageStyle={styles.chipImage}
            >
              <CoverOverlay active={active} />
              <Text
                numberOfLines={2}
                style={[
                  styles.label,
                  active && styles.labelActive,
                  { fontSize: isCompact ? 11 : 12 },
                ]}
              >
                {s.name}
              </Text>
            </ImageBackground>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 10,
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  chip: {
    flex: 1,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(11,31,58,0.18)',
    justifyContent: 'flex-end',
    paddingBottom: 14,
    paddingHorizontal: 8,
    backgroundColor: colors.navy,
  },
  chipActive: {
    borderColor: colors.brand,
    ...Platform.select({
      web: { boxShadow: '0 8px 20px rgba(0,166,81,0.28)' } as object,
      default: {
        shadowColor: colors.brand,
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      },
    }),
  },
  chipImage: {
    borderRadius: 999,
  },
  overlayBase: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayIdle: {
    backgroundColor: 'rgba(11,31,58,0.38)',
  },
  overlayActive: {
    backgroundColor: 'rgba(0,166,81,0.62)',
  },
  label: {
    zIndex: 1,
    textAlign: 'center',
    fontWeight: '800',
    color: colors.white,
    lineHeight: 15,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  labelActive: {
    color: colors.white,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
});
