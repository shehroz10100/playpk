import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { BranchReviewsDto } from '@playpk/shared-types';
import { api, API_BASE, ApiError } from '../../src/lib/api';
import { Badge, Button, Card, Input, Muted, Screen } from '../../src/components/ui';
import { colors, formatPkr } from '../../src/lib/theme';

type VenueDetail = {
  id: string;
  name: string;
  city: string;
  address: string;
  operatingHoursStart: string;
  operatingHoursEnd: string;
  avgRating: number | null;
  reviewCount?: number;
  company: { name: string; description?: string | null };
  sports: Array<{ id: string; name: string }>;
  photos: string[];
  courts: Array<{
    id: string;
    name: string;
    capacity: number;
    pricePerHour: number;
    indoor: boolean;
    hasAC: boolean;
    photos: string[];
    sport: { id: string; name: string };
  }>;
};

function resolveUrl(url: string) {
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [venue, setVenue] = useState<VenueDetail | null>(null);
  const [reviews, setReviews] = useState<BranchReviewsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [v, r] = await Promise.all([
      api<VenueDetail>(`/api/venues/${id}`, { auth: false }),
      api<BranchReviewsDto>(`/api/reviews/branches/${id}`, { auth: false }),
    ]);
    setVenue(v.data);
    setReviews(r.data);
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [id]);

  async function submitReview() {
    const stars = Number(rating);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      Alert.alert('Invalid rating', 'Enter 1–5');
      return;
    }
    setSubmitting(true);
    try {
      await api(`/api/reviews/branches/${id}`, {
        method: 'POST',
        body: JSON.stringify({ rating: stars, comment: comment || undefined }),
      });
      setComment('');
      await load();
      Alert.alert('Thanks!', 'Your review was saved.');
    } catch (err) {
      Alert.alert(
        'Review failed',
        err instanceof ApiError
          ? err.message
          : 'Complete a booking at this venue first, then try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <Screen>
        <Text style={{ color: colors.danger }}>{error}</Text>
      </Screen>
    );
  }
  if (!venue) {
    return (
      <Screen>
        <ActivityIndicator color={colors.brand} />
      </Screen>
    );
  }

  const avg = reviews?.avgRating ?? venue.avgRating;
  const count = reviews?.reviewCount ?? venue.reviewCount ?? 0;

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={styles.title}>{venue.name}</Text>
          <Muted>
            {venue.company.name} · {venue.address}, {venue.city}
          </Muted>
          <View style={styles.row}>
            <Badge label={avg ? `${avg.toFixed(1)}★ (${count})` : 'New'} tone="navy" />
            <Badge
              label={`${venue.operatingHoursStart}-${venue.operatingHoursEnd}`}
              tone="muted"
            />
          </View>

          <Text style={styles.section}>Sports offered</Text>
          <View style={styles.row}>
            {venue.sports.map((s) => (
              <Badge key={s.id} label={s.name} tone="brand" />
            ))}
          </View>

          {venue.photos.length > 0 ? (
            <>
              <Text style={styles.section}>Photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {venue.photos.map((url) => (
                  <Image key={url} source={{ uri: resolveUrl(url) }} style={styles.photo} />
                ))}
              </ScrollView>
            </>
          ) : null}

          <Text style={styles.section}>Leave a review</Text>
          <Muted>Requires a completed booking at this venue.</Muted>
          <Input
            value={rating}
            onChangeText={setRating}
            keyboardType="number-pad"
            placeholder="Rating 1–5"
            style={{ marginTop: 8 }}
          />
          <Input
            value={comment}
            onChangeText={setComment}
            placeholder="Comment (optional)"
            style={{ marginTop: 8 }}
          />
          <View style={{ marginTop: 10 }}>
            <Button label="Submit review" onPress={submitReview} loading={submitting} />
          </View>

          <Text style={styles.section}>Recent reviews</Text>
          {(reviews?.reviews ?? []).length === 0 ? (
            <Muted>No reviews yet.</Muted>
          ) : (
            (reviews?.reviews ?? []).slice(0, 5).map((r) => (
              <Card key={r.id}>
                <Text style={styles.courtName}>
                  {r.user.name} · {r.rating}★
                </Text>
                <Muted>{r.comment || 'No comment'}</Muted>
              </Card>
            ))
          )}

          <Text style={styles.section}>Courts</Text>
        </View>

        <FlatList
          data={venue.courts}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/court/${item.id}`)}>
              <Card>
                <Text style={styles.courtName}>{item.name}</Text>
                <Muted>
                  {item.sport.name} · Capacity {item.capacity} · {formatPkr(item.pricePerHour)}/hr
                </Muted>
                <View style={styles.row}>
                  <Badge label={item.indoor ? 'Indoor' : 'Outdoor'} />
                  <Badge label={item.hasAC ? 'AC' : 'No AC'} tone="muted" />
                </View>
              </Card>
            </Pressable>
          )}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '800', color: colors.navy },
  section: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '700',
    color: colors.navy,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  photo: {
    width: 160,
    height: 110,
    borderRadius: 12,
    marginRight: 10,
    backgroundColor: colors.border,
  },
  courtName: { fontSize: 16, fontWeight: '700', color: colors.navy, marginBottom: 4 },
});
