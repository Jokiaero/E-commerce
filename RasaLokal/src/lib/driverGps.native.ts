import * as Location from 'expo-location';

export function watchDriverPosition(onPosition: (position: Location.LocationObject) => void, onError: (message: string) => void): Promise<Location.LocationSubscription> {
  return Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000 }, onPosition, onError);
}
