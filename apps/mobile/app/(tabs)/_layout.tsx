import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../src/lib/theme';
import { NotificationsProvider } from '../../src/context/notifications';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: focused ? '800' : '600', color: focused ? colors.brand : colors.muted }}>
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <NotificationsProvider>
      <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.white,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { height: 60, paddingBottom: 8, paddingTop: 8 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} />,
          tabBarLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Book',
          tabBarIcon: ({ focused }) => <TabIcon label="Book" focused={focused} />,
          tabBarLabel: 'Book',
        }}
      />
      <Tabs.Screen
        name="tournaments"
        options={{
          title: 'Events',
          tabBarIcon: ({ focused }) => <TabIcon label="Events" focused={focused} />,
          tabBarLabel: 'Events',
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'AI',
          tabBarIcon: ({ focused }) => <TabIcon label="AI" focused={focused} />,
          tabBarLabel: 'AI',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Me',
          tabBarIcon: ({ focused }) => <TabIcon label="Me" focused={focused} />,
          tabBarLabel: 'Me',
        }}
      />
    </Tabs>
    </NotificationsProvider>
  );
}
