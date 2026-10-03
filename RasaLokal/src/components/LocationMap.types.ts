import type { Region } from 'react-native-maps';

export type LocationCoordinate = {
  latitude: number;
  longitude: number;
};

export type LocationMapProps = {
  coordinate: LocationCoordinate;
  region: Region;
  onCoordinateChange: (coordinate: LocationCoordinate) => void;
  onRegionChange: (region: Region) => void;
};