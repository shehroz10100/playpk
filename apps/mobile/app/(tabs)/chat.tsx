import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ChatbotResponse } from '@playpk/shared-types';
import { api, ApiError } from '../../src/lib/api';
import { Button, Card, Input, Muted, Screen } from '../../src/components/ui';
import { colors, formatPkr } from '../../src/lib/theme';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  slots?: ChatbotResponse['slots'];
  venues?: ChatbotResponse['venues'];
};

const EXAMPLES = [
  'Is padel available tomorrow evening in DHA?',
  'Padel near Johar Town',
  'Badminton slots today in Lahore',
  'Futsal this weekend morning',
];

export default function ChatScreen() {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask me about court availability — e.g. “Is padel available tomorrow evening in DHA?”',
    },
  ]);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setInput('');
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: question };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);
    try {
      const { data } = await api<ChatbotResponse>('/api/ai/chat', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ message: question }),
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.answer,
          slots: data.slots,
          venues: data.venues,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text:
            err instanceof ApiError
              ? err.message
              : 'Could not reach the AI service. Is the API running on :4000?',
        },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 12 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListHeaderComponent={
            <View style={styles.examples}>
              {EXAMPLES.map((ex) => (
                <Text key={ex} style={styles.example} onPress={() => send(ex)}>
                  {ex}
                </Text>
              ))}
            </View>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === 'user' ? styles.userBubble : styles.botBubble,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  item.role === 'user' ? styles.userText : styles.botText,
                ]}
              >
                {item.text}
              </Text>
              {item.venues && item.venues.length > 0 && !(item.slots && item.slots.length > 0) ? (
                <View style={{ marginTop: 10 }}>
                  {item.venues.map((v) => (
                    <Card key={v.id} style={{ marginBottom: 8 }}>
                      <Text style={styles.slotTitle}>{v.name}</Text>
                      <Muted>
                        {v.address}, {v.city}
                        {v.sports.length ? ` · ${v.sports.join(', ')}` : ''}
                      </Muted>
                    </Card>
                  ))}
                </View>
              ) : null}
              {item.slots && item.slots.length > 0 ? (
                <View style={{ marginTop: 10 }}>
                  {item.slots.map((s) => (
                    <Card key={s.id} style={{ marginBottom: 8 }}>
                      <Text style={styles.slotTitle}>
                        {s.branch} · {s.court}
                      </Text>
                      <Muted>
                        {s.sport} · {String(s.date).slice(0, 10)} · {s.startTime}–{s.endTime} ·{' '}
                        {formatPkr(s.price)}
                      </Muted>
                    </Card>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        />

        {busy ? (
          <View style={styles.thinking}>
            <ActivityIndicator color={colors.brand} />
            <Muted> Searching slots…</Muted>
          </View>
        ) : null}

        <View style={styles.composer}>
          <Input
            value={input}
            onChangeText={setInput}
            placeholder="Ask about courts…"
            style={{ flex: 1 }}
            onSubmitEditing={() => send(input)}
            returnKeyType="send"
          />
          <View style={{ width: 8 }} />
          <Button label="Send" onPress={() => send(input)} loading={busy} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  examples: { marginBottom: 12, gap: 8 },
  example: {
    color: colors.brandDark,
    fontWeight: '600',
    fontSize: 13,
    backgroundColor: '#E8F8EF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  bubble: {
    maxWidth: '92%',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.navy,
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  userText: { color: colors.white },
  botText: { color: colors.navy },
  slotTitle: { fontWeight: '700', color: colors.navy, marginBottom: 2 },
  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
