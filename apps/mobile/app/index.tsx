import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { getAccessToken, isOnboarded } from '../src/lib/auth';
import { colors } from '../src/lib/theme';

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const onboarded = await isOnboarded();
      if (!onboarded) {
        setTarget('/onboarding/city');
        return;
      }
      const token = await getAccessToken();
      setTarget(token ? '/(tabs)' : '/onboarding/login');
    })();
  }, []);

  if (!target) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return <Redirect href={target as '/(tabs)'} />;
}
