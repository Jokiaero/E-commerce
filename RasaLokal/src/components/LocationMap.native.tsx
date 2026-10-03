import { Platform, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type { LocationMapProps } from './LocationMap.types';

export default function LocationMap({ coordinate, region, onCoordinateChange, onRegionChange }: LocationMapProps) {
  return (
    <MapView
      style={styles.map}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      region={region}
      showsCompass
      showsScale
      onRegionChangeComplete={onRegionChange}
      onPress={(event) => onCoordinateChange(event.nativeEvent.coordinate)}
    >
      <Marker
        coordinate={coordinate}
        draggable
        pinColor="#E45A3B"
        title="Lokasi pilihan"
        description="Geser pin untuk memilih alamat"
        onDragEnd={(event) => onCoordinateChange(event.nativeEvent.coordinate)}
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});