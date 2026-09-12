import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import * as Location from 'expo-location';
import { Camera, Map as MapLibreMap, type MapRef } from '@maplibre/maplibre-react-native';
import { api } from '../../../convex/_generated/api';
import type { Doc } from '../../../convex/_generated/dataModel';
import { Bloub } from '../../components/Bloub';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { SectionHeader } from '../../components/ui/Bits';
import { Sheet } from '../../components/ui/Sheet';
import { colors, radius, shadow, spacing } from '../../theme/tokens';
import { useMyToken } from '../../lib/identity';
import { MAP_STYLE_URL, timeAgo } from '../../lib/utils';
import { hapticSuccess, useHaptics } from '../../hooks/useHaptics';

type Place = Doc<'places'>;
type Step = 'details' | 'map' | 'confirm';

const RADIUS_OPTIONS = [100, 150, 300, 500];

const PLACE_COLORS = [
  '#FF6B4A',
  '#3E8EDE',
  '#2FA37C',
  '#9B7EDE',
  '#F0A93B',
  '#E152B0',
];

function placeColor(index: number): string {
  return PLACE_COLORS[index % PLACE_COLORS.length];
}

export default function PlacesScreen() {
  const token = useMyToken();
  const haptic = useHaptics();

  const places = useQuery(api.places.list, token ? { token } : 'skip');
  const events = useQuery(
    api.places.events,
    token ? { token, limit: 20 } : 'skip',
  );

  const removeFn = useMutation(api.places.remove);

  const [addOpen, setAddOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);

  const placesById = useMemo(() => {
    const map = new Map<string, Place>();
    for (const p of places ?? []) map.set(p._id, p);
    return map;
  }, [places]);

  async function doRemove() {
    if (!token || !removeTarget) return;
    setBusy(true);
    try {
      await removeFn({ token, placeId: removeTarget._id });
      hapticSuccess();
      setEditingPlace(null);
      setRemoveTarget(null);
    } catch {
      haptic('medium');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerMid}>
            <Text style={styles.title}>Places</Text>
            <Text style={styles.purpose}>Gentle nudges when family reaches a spot</Text>
          </View>
          <Pressable
            onPress={() => {
              haptic('medium');
              setAddOpen(true);
            }}
            style={({ pressed }) => [styles.addPill, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.addPillText}>Add a place</Text>
          </Pressable>
        </View>

        <SectionHeader title="Your spots" />

        {places && places.length === 0 ? (
          <EmptyState
            bloub={{
              state: 'sleep',
              expression: 'somnolent',
              color: colors.lilac,
              size: 90,
            }}
            title="No places yet"
            subtitle="Add Home first — it powers arrival nudges for everyone"
          />
        ) : (
          <View style={styles.placeList}>
            {(places ?? []).map((place, index) => (
              <View key={place._id} style={styles.rowWrap}>
                <View style={styles.placeCard}>
                  <Bloub
                    size={40}
                    shape="goutte"
                    color={placeColor(index)}
                    expression="attentif"
                    paper={colors.cream}
                    frozenAt={1.2}
                  />
                  <View style={styles.placeMid}>
                    <Text style={styles.placeName}>{place.name}</Text>
                    <Text style={styles.placeRadius}>within {place.radiusM} m</Text>
                  </View>
                  <View style={styles.chipRow}>
                    {place.notifyOnArrive ? (
                      <View style={[styles.chip, { backgroundColor: colors.mintSoft }]}>
                        <Text style={styles.chipText}>Arrivals on</Text>
                      </View>
                    ) : null}
                    {place.notifyOnLeave ? (
                      <View style={[styles.chip, { backgroundColor: colors.lilacSoft }]}>
                        <Text style={styles.chipText}>Departures on</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={() => {
                    haptic('light');
                    setEditingPlace(place);
                  }}
                  onLongPress={() => {
                    haptic('medium');
                    setRemoveTarget(place);
                  }}
                />
              </View>
            ))}
          </View>
        )}

        <SectionHeader title="Recent" />

        {events && events.length > 0 ? (
          <View style={styles.eventCard}>
            {events.map((ev) => {
              const place = placesById.get(ev.placeId);
              return (
                <View key={ev._id} style={styles.eventRow}>
                  <Text style={styles.eventText}>
                    {ev.memberName}{' '}
                    {ev.type === 'arrive' ? 'arrived at' : 'left'} {place?.name ?? 'a place'}
                  </Text>
                  <Text style={styles.eventTime}>{timeAgo(ev.ts)}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.emptyEvents}>No visits yet</Text>
        )}
      </ScrollView>

      <PlaceSheet visible={addOpen} onClose={() => setAddOpen(false)} />

      <PlaceSheet
        visible={!!editingPlace}
        onClose={() => setEditingPlace(null)}
        editing={editingPlace}
        onRemove={(place) => setRemoveTarget(place)}
      />

      <Sheet
        visible={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={`Remove ${removeTarget?.name ?? ''}?`}
      >
        <Text style={styles.sheetText}>
          Its visit history goes too. You can always add it back.
        </Text>
        <Button label="Remove place" variant="danger" onPress={doRemove} loading={busy} />
      </Sheet>
    </View>
  );
}

function PlaceSheet({
  visible,
  onClose,
  editing,
  onRemove,
}: {
  visible: boolean;
  onClose: () => void;
  editing?: Place | null;
  onRemove?: (place: Place) => void;
}) {
  const token = useMyToken();
  const haptic = useHaptics();

  const isEdit = !!editing;

  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [radiusM, setRadiusM] = useState(150);
  const [notifyOnArrive, setNotifyOnArrive] = useState(true);
  const [notifyOnLeave, setNotifyOnLeave] = useState(false);
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null);
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    if (!visible) return;
    setStep('details');
    if (editing) {
      setName(editing.name);
      setRadiusM(editing.radiusM);
      setNotifyOnArrive(editing.notifyOnArrive);
      setNotifyOnLeave(editing.notifyOnLeave);
      setPicked({ lat: editing.lat, lng: editing.lng });
      setMyLoc({ lat: editing.lat, lng: editing.lng });
    } else {
      setName('');
      setRadiusM(150);
      setNotifyOnArrive(true);
      setNotifyOnLeave(false);
      setPicked(null);
      (async () => {
        try {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setMyLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        } catch {
          setMyLoc(null);
        }
      })();
    }
  }, [visible, editing]);

  const openMap = useCallback(() => {
    haptic('light');
    setStep('map');
  }, [haptic]);

  const pinHere = useCallback(async () => {
    try {
      const center = await mapRef.current?.getCenter();
      if (!center) return;
      setPicked({ lat: center[1], lng: center[0] });
      haptic('light');
      setStep('confirm');
    } catch {
      haptic('medium');
    }
  }, [haptic]);

  const addFn = useMutation(api.places.add);
  const updateFn = useMutation(api.places.update);

  async function doSave() {
    if (!token) return;
    if (!isEdit && !picked) return;
    setBusy(true);
    try {
      if (editing) {
        await updateFn({
          token,
          placeId: editing._id,
          name: name.trim() || editing.name,
          ...(picked ? { lat: picked.lat, lng: picked.lng } : {}),
          radiusM,
          notifyOnArrive,
          notifyOnLeave,
        });
      } else {
        await addFn({
          token,
          name: name.trim() || 'New place',
          emoji: '',
          lat: picked!.lat,
          lng: picked!.lng,
          radiusM,
          notifyOnArrive,
          notifyOnLeave,
        });
      }
      hapticSuccess();
      onClose();
    } catch {
      haptic('medium');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheetCard}>
          <View style={styles.grabber} />
          {step === 'details' ? (
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.sheetTitle}>{isEdit ? 'Edit place' : 'Add a place'}</Text>
              <Input
                value={name}
                onChangeText={(t) => setName(t.slice(0, 24))}
                placeholder="e.g. Home, School, Grandma"
                autoFocus={!isEdit}
              />
              <Text style={styles.fieldLabel}>How close counts?</Text>
              <View style={styles.radiusRow}>
                {RADIUS_OPTIONS.map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setRadiusM(r)}
                    style={[styles.radiusChip, radiusM === r && styles.radiusChipSelected]}
                  >
                    <Text style={[styles.radiusText, radiusM === r && styles.radiusTextSelected]}>
                      {r} m
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Button
                label={isEdit ? 'Adjust the spot on the map' : 'Pick the spot on the map'}
                onPress={openMap}
              />
              {isEdit && editing ? (
                <Pressable
                  onPress={() => {
                    haptic('medium');
                    onRemove?.(editing);
                  }}
                  style={styles.removeLink}
                >
                  <Text style={styles.removeLinkText}>Remove this place</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          ) : null}

          {step === 'map' ? (
            <View style={styles.mapStep}>
              <Text style={styles.sheetTitle}>Pick the spot on the map</Text>
              <View style={styles.mapWrap}>
                {myLoc ? (
                  <MapLibreMap
                    ref={mapRef}
                    style={styles.map}
                    mapStyle={MAP_STYLE_URL}
                    attribution={false}
                    logo={false}
                    compass={false}
                  >
                    <Camera initialViewState={{ center: [myLoc.lng, myLoc.lat], zoom: 15 }} />
                  </MapLibreMap>
                ) : (
                  <View style={[styles.map, styles.mapLoading]}>
                    <Text style={styles.mapLoadingText}>Finding you…</Text>
                  </View>
                )}
                <View style={styles.crosshair} pointerEvents="none">
                  <View style={styles.crosshairBarH} />
                  <View style={styles.crosshairBarV} />
                </View>
              </View>
              <Button
                label="Pin it here"
                onPress={pinHere}
                disabled={!myLoc}
              />
              <Button
                label="Back"
                variant="ghost"
                onPress={() => setStep('details')}
                style={styles.sheetBack}
              />
            </View>
          ) : null}

          {step === 'confirm' && picked ? (
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetContent}
            >
              <Text style={styles.sheetTitle}>Looks good?</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryMid}>
                  <Text style={styles.summaryName}>
                    {name.trim() || (isEdit ? editing?.name : 'New place')}
                  </Text>
                  <Text style={styles.summaryMeta}>
                    within {radiusM} m · {picked.lat.toFixed(4)}, {picked.lng.toFixed(4)}
                  </Text>
                </View>
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Notify on arrival</Text>
                <Switch
                  value={notifyOnArrive}
                  onValueChange={setNotifyOnArrive}
                  trackColor={{ true: colors.mint, false: colors.borderStrong }}
                  thumbColor={colors.white}
                />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Notify on leaving</Text>
                <Switch
                  value={notifyOnLeave}
                  onValueChange={setNotifyOnLeave}
                  trackColor={{ true: colors.mint, false: colors.borderStrong }}
                  thumbColor={colors.white}
                />
              </View>
              <Button
                label={isEdit ? 'Save changes' : 'Add place'}
                onPress={doSave}
                loading={busy}
              />
              <Button
                label="Back"
                variant="ghost"
                onPress={() => setStep('map')}
                style={styles.sheetBack}
              />
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  scroll: { flex: 1 },
  content: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.l,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.m,
  },
  headerMid: { flex: 1 },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: 'Nunito_800ExtraBold',
  },
  purpose: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkSoft,
    marginTop: 2,
    fontFamily: 'Nunito_600SemiBold',
  },
  addPill: {
    backgroundColor: colors.coral,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
    ...shadow.float,
  },
  addPillText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
    fontFamily: 'Nunito_800ExtraBold',
  },
  placeList: { gap: spacing.m },
  rowWrap: { borderRadius: radius.l },
  placeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.l,
    ...shadow.card,
  },
  placeMid: { flex: 1, gap: 2 },
  placeName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: 'Nunito_800ExtraBold',
  },
  placeRadius: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  chipRow: { alignItems: 'flex-end', gap: spacing.xs },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.ink },
  eventCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.m,
    gap: spacing.m,
    ...shadow.card,
  },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  eventText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink },
  eventTime: { fontSize: 12, fontWeight: '700', color: colors.inkFaint },
  emptyEvents: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkFaint,
    fontFamily: 'Nunito_600SemiBold',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(35,29,21,0.35)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.s,
    maxHeight: '88%',
    ...shadow.float,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.m,
  },
  sheetScroll: { flexGrow: 0 },
  sheetContent: { gap: spacing.l, paddingBottom: spacing.s },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: 'Nunito_800ExtraBold',
  },
  sheetBack: { marginTop: -spacing.m },
  sheetText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inkSoft,
    lineHeight: 21,
    marginBottom: spacing.l,
    fontFamily: 'Nunito_600SemiBold',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkSoft,
    marginLeft: 4,
  },
  radiusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  radiusChip: {
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  radiusChipSelected: {
    borderColor: colors.coral,
    backgroundColor: colors.coralSoft,
  },
  radiusText: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  radiusTextSelected: { color: colors.ink },
  mapStep: { gap: spacing.m },
  mapWrap: {
    height: 320,
    borderRadius: radius.l,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  map: { flex: 1 },
  mapLoading: { alignItems: 'center', justifyContent: 'center' },
  mapLoadingText: { fontSize: 14, fontWeight: '700', color: colors.inkSoft },
  crosshair: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 34,
    height: 34,
    marginLeft: -17,
    marginTop: -17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crosshairBarH: {
    position: 'absolute',
    width: 34,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.coral,
  },
  crosshairBarV: {
    position: 'absolute',
    width: 3,
    height: 34,
    borderRadius: 2,
    backgroundColor: colors.coral,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    backgroundColor: colors.surface,
    borderRadius: radius.l,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.l,
  },
  summaryMid: { flex: 1, gap: 2 },
  summaryName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: 'Nunito_800ExtraBold',
  },
  summaryMeta: { fontSize: 12, fontWeight: '600', color: colors.inkSoft },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.s,
  },
  toggleLabel: { fontSize: 15, fontWeight: '700', color: colors.ink },
  removeLink: { alignItems: 'center', paddingVertical: spacing.m },
  removeLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
    fontFamily: 'Nunito_700Bold',
  },
});
