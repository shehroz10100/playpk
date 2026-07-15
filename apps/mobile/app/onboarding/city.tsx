import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Subtitle, Title } from '../../src/components/ui';
import { setCity } from '../../src/lib/auth';
import { cities, colors } from '../../src/lib/theme';

export default function CityOnboarding() {
  const router = useRouter();
  const [selected, setSelected] = useState<string>('Lahore');
  const [saving, setSaving] = useState(false);

  async function continueNext() {
    setSaving(true);
    await setCity(selected);
    setSaving(false);
    router.replace('/onboarding/login');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.hero}>
        <Text style={styles.brand}>PlayPK</Text>
        <Title>Where do you play?</Title>
        <Subtitle>Pick your city to see nearby courts and grounds.</Subtitle>
      </View>

      <FlatList
        data={[...cities]}
        keyExtractor={(item) => item}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item }) => {
          const active = item === selected;
          return (
            <Pressable
              onPress={() => setSelected(item)}
              style={[styles.city, active && styles.cityActive]}
            >
              <Text style={[styles.cityText, active && styles.cityTextActive]}>{item}</Text>
            </Pressable>
          );
        }}
      />

      <View style={styles.footer}>
        <Button label="Continue" onPress={continueNext} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  hero: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 12 },
  brand: {
    color: colors.brand,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
    fontSize: 12,
  },
  city: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cityActive: {
    borderColor: colors.brand,
    backgroundColor: '#E8F8EF',
  },
  cityText: { color: colors.navy, fontSize: 16, fontWeight: '600' },
  cityTextActive: { color: colors.brandDark },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
});
