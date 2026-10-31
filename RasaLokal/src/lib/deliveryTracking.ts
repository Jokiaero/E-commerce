export type DeliveryCoordinate = { latitude: number; longitude: number };
export type DriverTracking = {
  driverId: string;
  name: string;
  phone: string;
  vehicle: string;
  coordinate: DeliveryCoordinate | null;
  accuracy: number | null;
  recordedAt: string | null;
  pickup: DeliveryCoordinate | null;
  destination: DeliveryCoordinate | null;
};

export const TRACKING_STEPS = [
  { label: 'Dipesan', statuses: ['pending_payment', 'confirmed', 'pending'] },
  { label: 'Disiapkan', statuses: ['merchant_accepted', 'accepted', 'preparing', 'processing', 'ready_for_pickup', 'driver_assigned', 'driver_going_to_merchant', 'driver_arrived_merchant'] },
  { label: 'Dikirim', statuses: ['picked_up', 'driver_going_to_customer', 'driver_arrived', 'shipped'] },
  { label: 'Selesai', statuses: ['delivered', 'completed'] },
] as const;

export function getTrackingStage(status: string): number | null {
  const index = TRACKING_STEPS.findIndex((step) => (step.statuses as readonly string[]).includes(status));
  return index < 0 ? null : index;
}

export function deliveryCoordinate(latitude: unknown, longitude: unknown): DeliveryCoordinate | null {
  return typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180
    ? { latitude, longitude } : null;
}

export function distanceMeters(from: DeliveryCoordinate, to: DeliveryCoordinate): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const a = Math.sin(radians(to.latitude - from.latitude) / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(radians(to.longitude - from.longitude) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function isFreshDriverLocation(recordedAt: string | null, now = Date.now()): boolean {
  if (!recordedAt) return false;
  const age = now - new Date(recordedAt).getTime();
  return Number.isFinite(age) && age >= -30000 && age <= 90000;
}

export function getNextMerchantStatus(status: string): 'merchant_accepted' | 'preparing' | 'ready_for_pickup' | null {
  if (status === 'confirmed' || status === 'pending') return 'merchant_accepted';
  if (status === 'merchant_accepted' || status === 'accepted') return 'preparing';
  if (status === 'preparing' || status === 'processing') return 'ready_for_pickup';
  return null;
}

export const SHIPPING_STATUSES = ['driver_assigned', 'driver_going_to_merchant', 'driver_arrived_merchant', 'picked_up', 'driver_going_to_customer', 'driver_arrived', 'delivered'] as const;
