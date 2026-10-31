import type { LocationObject, LocationSubscription } from 'expo-location';

export async function watchDriverPosition(onPosition: (position: LocationObject) => void, onError: (message: string) => void): Promise<LocationSubscription> {
  if (!navigator.geolocation) throw new Error('Browser ini belum mendukung GPS.');
  const watchId = navigator.geolocation.watchPosition((position) => {
    onPosition({ timestamp: position.timestamp, coords: {
      latitude: position.coords.latitude, longitude: position.coords.longitude,
      accuracy: position.coords.accuracy, altitude: position.coords.altitude,
      altitudeAccuracy: position.coords.altitudeAccuracy, heading: position.coords.heading, speed: position.coords.speed,
    } });
  }, () => onError('Sinyal GPS tidak tersedia. Periksa izin dan layanan lokasi perangkat.'), {
    enableHighAccuracy: true, maximumAge: 0, timeout: 15000,
  });
  return { remove: () => navigator.geolocation.clearWatch(watchId) };
}
