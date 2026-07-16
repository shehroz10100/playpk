'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ChatbotResponse } from '@playpk/shared-types';
import { api, ApiError } from '@/lib/api';
import { formatPkr } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

export default function AiPage() {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask me about court availability — e.g. “Is padel available tomorrow evening in DHA?”',
    },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setInput('');
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: question }]);
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
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-navy">PlayPK AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask about sports, areas, and open slots near you.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => void send(ex)}
            className="rounded-full border border-border bg-white px-3 py-1.5 text-left text-xs text-navy hover:border-brand hover:text-brand"
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-white p-4 shadow-sm">
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === 'user'
                ? 'ml-8 rounded-lg bg-brand px-3 py-2 text-sm text-white'
                : 'mr-8 rounded-lg bg-muted px-3 py-2 text-sm text-navy'
            }
          >
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.venues && m.venues.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs opacity-90">
                {m.venues.slice(0, 4).map((v) => (
                  <li key={v.id}>
                    <Link className="underline" href={`/venues/${v.id}`}>
                      {v.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            {m.slots && m.slots.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs opacity-90">
                {m.slots.slice(0, 5).map((s) => (
                  <li key={s.id}>
                    {s.branch} · {s.court} · {s.date?.toString().slice(0, 10)} · {s.startTime}–
                    {s.endTime}
                    {s.price != null ? ` · ${formatPkr(Number(s.price))}` : ''}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
        {busy ? <p className="text-xs text-muted-foreground">Thinking…</p> : null}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about padel, cricket, futsal…"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
