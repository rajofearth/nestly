import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Doc } from '../../../convex/_generated/dataModel';
import { Bloub } from '../../components/Bloub';
import { MemberAvatar } from '../../components/ui/MemberAvatar';
import { colors, radius, shadow, typography } from '../../theme/tokens';
import { useMyToken, type NestlyUser } from '../../lib/identity';
import { useMeSync } from '../../lib/useMeSync';
import { useCircle } from '../../lib/useCircle';
import { useHaptics } from '../../hooks/useHaptics';

type Message = Doc<'messages'>;
type Member = NestlyUser;

interface TimeRow {
  kind: 'time';
  key: string;
  ts: number;
}

interface MsgRow {
  kind: 'msg';
  key: string;
  msg: Message;
  firstOfGroup: boolean;
}

type Row = TimeRow | MsgRow;

const FIFTEEN_MIN = 15 * 60 * 1000;

function sameDay(a: number, b: number) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function timeLabel(ts: number) {
  const d = new Date(ts);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((dayStart(new Date()) - dayStart(d)) / 86_400_000);
  if (days <= 0) return `Today ${hm}`;
  if (days === 1) return `Yesterday ${hm}`;
  return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })} ${hm}`;
}

export default function Chat() {
  const token = useMyToken();
  const me = useMeSync();
  const { members } = useCircle();
  const haptic = useHaptics();
  const { to } = useLocalSearchParams<{ to?: string }>();
  const [text, setText] = useState('');
  const [chipDismissed, setChipDismissed] = useState(false);

  const messages = useQuery(api.chat.list, token ? { token, limit: 100 } : 'skip');
  const send = useMutation(api.chat.send);

  const toMember = useMemo(
    () => (to ? members.find((m) => m._id === to) ?? null : null),
    [to, members],
  );

  useEffect(() => {
    setChipDismissed(false);
  }, [to]);

  const memberById = useMemo(() => {
    const map = new Map<string, Member>();
    for (const m of members) map.set(m._id, m);
    return map;
  }, [members]);

  const rows = useMemo<Row[]>(() => {
    const msgs = messages ?? [];
    const out: Row[] = [];
    let prev: Message | null = null;
    for (const m of msgs) {
      const gap = !!prev && (m.ts - prev.ts > FIFTEEN_MIN || !sameDay(prev.ts, m.ts));
      if (gap) out.push({ kind: 'time', key: `t-${m._id}`, ts: m.ts });
      out.push({
        kind: 'msg',
        key: m._id,
        msg: m,
        firstOfGroup: !prev || gap || prev.userId !== m.userId,
      });
      prev = m;
    }
    return out.reverse();
  }, [messages]);

  function onSend() {
    const value = text.trim();
    if (!token || !value) return;
    haptic();
    setText('');
    send({ token, text: value }).catch(() => {});
  }

  const renderItem = ({ item }: { item: Row }) => {
    if (item.kind === 'time') {
      return (
        <View style={styles.flip}>
          <Text style={styles.time}>{timeLabel(item.ts)}</Text>
        </View>
      );
    }
    const mine = !!me && item.msg.userId === me._id;
    if (mine) {
      return (
        <View style={styles.flip}>
          <View style={styles.mineRow}>
            <View style={[styles.bubble, styles.bubbleMine]}>
              <Text style={styles.textMine}>{item.msg.text}</Text>
            </View>
          </View>
        </View>
      );
    }
    const author = memberById.get(item.msg.userId);
    return (
      <View style={styles.flip}>
        {item.firstOfGroup && author ? (
          <Text style={styles.author}>{author.name}</Text>
        ) : null}
        <View style={styles.theirRow}>
          {item.firstOfGroup && author ? (
            <MemberAvatar avatar={author.avatar} size={28} />
          ) : (
            <View style={styles.avatarSpacer} />
          )}
          <View style={[styles.bubble, styles.bubbleTheir]}>
            <Text style={styles.textTheir}>{item.msg.text}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Chat</Text>
      {messages !== undefined && rows.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Bloub
            size={120}
            shape="capsule"
            color={colors.sky}
            expression="excite"
            state="idle"
            paper={colors.cream}
            animate
          />
          <Text style={styles.emptyTitle}>Say hi to the nest</Text>
          <Text style={styles.emptySub}>
            Quick updates, funny moments, and check-ins live here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          renderItem={renderItem}
          keyExtractor={(r) => r.key}
          inverted
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
      <View style={styles.composer}>
        {toMember && !chipDismissed ? (
          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>Messaging {toMember.name}</Text>
              <Pressable hitSlop={8} onPress={() => setChipDismissed(true)}>
                <Text style={styles.chipX}>✕</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Message the nest…"
            placeholderTextColor={colors.inkFaint}
            multiline
          />
          <Pressable
            onPress={onSend}
            disabled={!text.trim()}
            style={({ pressed }) => [
              styles.send,
              (!text.trim() || pressed) && { opacity: 0.5 },
            ]}
          >
            <Text style={styles.sendIcon}>➤</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  title: {
    ...typography.title,
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 8,
  },
  listContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 4 },
  flip: { transform: [{ scaleY: -1 }] },
  time: {
    ...typography.tiny,
    textAlign: 'center',
    alignSelf: 'center',
    marginVertical: 8,
  },
  mineRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  theirRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  avatarSpacer: { width: 28 },
  author: {
    ...typography.tiny,
    color: colors.inkSoft,
    marginLeft: 36,
    marginBottom: 2,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginVertical: 2,
  },
  bubbleMine: {
    backgroundColor: colors.ink,
    borderBottomRightRadius: 6,
    ...shadow.card,
  },
  bubbleTheir: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textMine: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 15,
    lineHeight: 21,
    color: colors.white,
  },
  textTheir: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 15,
    lineHeight: 21,
    color: colors.ink,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: { ...typography.heading, textAlign: 'center' },
  emptySub: {
    ...typography.bodySoft,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  composer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: colors.cream,
  },
  chipRow: { flexDirection: 'row', marginBottom: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.coralSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  chipX: { fontSize: 12, fontWeight: '800', color: colors.inkSoft },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 48,
    maxHeight: 120,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  sendIcon: { color: colors.white, fontSize: 18, fontWeight: '800' },
});

