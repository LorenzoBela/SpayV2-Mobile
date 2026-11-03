import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useImpersonation } from '../context/ImpersonationContext';
import { fetchOrderItemSuggestions } from '../services/adminService';
import { supabase } from '../utils/supabase';

type Props = TextInputProps & {
  enabled: boolean;
  textColor: string;
  borderColor: string;
  value: string;
  onChangeText: (value: string) => void;
};

export function RepeatOrderItemInput({
  enabled, textColor, borderColor, value, onChangeText, ...inputProps
}: Props) {
  const [focused, setFocused] = useState(false);
  const [token, setToken] = useState('');
  const [result, setResult] = useState<{ key: string; names: string[]; unavailable?: boolean }>();
  const cache = useRef(new Map<string, { names: string[]; expires: number }>());
  const input = useRef<TextInput>(null);
  const lastToken = useRef('');
  const query = value.trim().toLowerCase();
  const { isImpersonating } = useImpersonation();
  const available = enabled && !isImpersonating;
  const active = available && focused;
  const key = active && token && query.length !== 1 && query.length <= 100
    ? JSON.stringify([query])
    : '';
  const names = key && result?.key === key ? result.names : [];

  useEffect(() => {
    if (!active) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextToken = session?.access_token ?? '';
      if (lastToken.current === nextToken) return;
      lastToken.current = nextToken;
      cache.current.clear();
      setResult(undefined);
      setToken(nextToken);
    });
    return () => subscription.unsubscribe();
  }, [active]);

  useEffect(() => {
    if (!key) return;
    const entries = cache.current;
    const hit = entries.get(key);
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const debounce = setTimeout(async () => {
      if (hit && hit.expires > Date.now()) {
        setResult({ key, names: hit.names });
        return;
      }
      const showUnavailable = () => {
        if (!controller.signal.aborted) setResult({ key, names: [], unavailable: true });
      };
      timeout = setTimeout(() => {
        showUnavailable();
        controller.abort();
      }, 3000);
      try {
        const names = await fetchOrderItemSuggestions(query, token, controller.signal);
        if (!names) {
          showUnavailable();
          return;
        }
        if (controller.signal.aborted) return;
        if (entries.size >= 12) {
          const oldest = entries.keys().next().value;
          if (oldest !== undefined) entries.delete(oldest);
        }
        entries.set(key, { names, expires: Date.now() + 15000 });
        setResult({ key, names });
      } catch {
        showUnavailable();
      } finally {
        clearTimeout(timeout);
      }
    }, query ? 250 : 0);
    return () => {
      clearTimeout(debounce);
      clearTimeout(timeout);
      controller.abort();
    };
  }, [key, query, token]);

  useEffect(() => {
    if (!available) input.current?.blur();
  }, [available]);

  function close() {
    setFocused(false);
    setResult(undefined);
    lastToken.current = '';
    cache.current.clear();
    setToken('');
  }

  return (
    <View>
      <TextInput
        {...inputProps}
        ref={input}
        accessibilityLabel="Item name"
        value={value}
        onChangeText={text => {
          if (text.trim().toLowerCase() !== query) setResult(undefined);
          onChangeText(text);
        }}
        onFocus={() => setFocused(true)}
        onBlur={close}
      />
      {Boolean(key) && result?.key === key && names.length === 0 && (
        <Text style={[styles.heading, { color: textColor }]} accessibilityLiveRegion="polite">
          {result.unavailable
            ? 'Suggestions unavailable. You can still enter an item name.'
            : 'No matches in recent orders. You can enter a new name.'}
        </Text>
      )}
      {names.length > 0 && (
        <View style={[styles.results, { borderColor }]}>
          <Text style={[styles.heading, { color: textColor }]}>Repeat order</Text>
          {names.map(name => (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityLabel={name}
              accessibilityHint="Fills in the item name"
              style={[styles.option, { borderColor }]}
              onPress={() => {
                onChangeText(name);
                close();
                input.current?.blur();
              }}
            >
              <Text style={{ color: textColor }}>{name}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  results: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, marginTop: 4 },
  heading: { fontWeight: '600', paddingHorizontal: 10, paddingVertical: 6 },
  option: {
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
