import { View } from 'react-native';
import type { DriverTracking } from '@/lib/deliveryTracking';

export default function DriverLocationMap({ driver }: { driver: DriverTracking }) {
  if (!driver.coordinate) return null;
  const { latitude, longitude } = driver.coordinate;
  const params = new URLSearchParams({
    bbox: `${Math.max(-180, longitude - 0.008)},${Math.max(-85, latitude - 0.005)},${Math.min(180, longitude + 0.008)},${Math.min(85, latitude + 0.005)}`,
    layer: 'mapnik', marker: `${latitude},${longitude}`,
  });
  return <View style={{ height: 240, width: '100%', overflow: 'hidden', borderRadius: 12 }}>
    <iframe title="Lokasi GPS driver" src={`https://www.openstreetmap.org/export/embed.html?${params}`} style={{ width: '100%', height: '100%', border: 0 }} referrerPolicy="no-referrer" loading="lazy" />
  </View>;
}
