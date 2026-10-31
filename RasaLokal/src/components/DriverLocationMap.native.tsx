import MapView, { Marker } from 'react-native-maps';
import type { DriverTracking } from '@/lib/deliveryTracking';

export default function DriverLocationMap({ driver }: { driver: DriverTracking }) {
  if (!driver.coordinate) return null;
  return <MapView style={{ height: 240, width: '100%' }} region={{ ...driver.coordinate, latitudeDelta: 0.012, longitudeDelta: 0.012 }}>
    <Marker coordinate={driver.coordinate} title={driver.name} pinColor="#FF5A00" />
    {driver.pickup && <Marker coordinate={driver.pickup} title="Lokasi toko" pinColor="#16A34A" />}
    {driver.destination && <Marker coordinate={driver.destination} title="Alamat pengiriman" pinColor="#2563EB" />}
  </MapView>;
}
