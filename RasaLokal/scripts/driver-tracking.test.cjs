const assert = require('node:assert/strict');
const { test } = require('node:test');
const { deliveryCoordinate, distanceMeters, isFreshDriverLocation, getNextMerchantStatus } = require('../src/lib/deliveryTracking.ts');

test('merchants can only advance preparation, never payment or transport', () => {
  assert.equal(getNextMerchantStatus('confirmed'), 'merchant_accepted');
  assert.equal(getNextMerchantStatus('merchant_accepted'), 'preparing');
  assert.equal(getNextMerchantStatus('preparing'), 'ready_for_pickup');
  for (const status of ['pending_payment', 'ready_for_pickup', 'driver_assigned', 'driver_going_to_merchant', 'driver_arrived_merchant', 'picked_up', 'driver_going_to_customer', 'driver_arrived', 'delivered', 'completed', 'cancelled', 'payment_failed']) {
    assert.equal(getNextMerchantStatus(status), null, status);
  }
});

test('invalid GPS points never become map markers; zero coordinates are valid', () => {
  assert.deepEqual(deliveryCoordinate(0, 0), { latitude: 0, longitude: 0 });
  for (const point of [[null, null], [undefined, 100], [NaN, 0], [0, Infinity], [91, 0], [0, -181], ['-2.97', '104.75']]) {
    assert.equal(deliveryCoordinate(...point), null);
  }
});

test('a silent GPS feed is marked stale and future or invalid timestamps are rejected', () => {
  const now = Date.now();
  assert.equal(isFreshDriverLocation(new Date(now - 10000).toISOString(), now), true);
  assert.equal(isFreshDriverLocation(new Date(now - 91000).toISOString(), now), false);
  assert.equal(isFreshDriverLocation(new Date(now + 31000).toISOString(), now), false);
  assert.equal(isFreshDriverLocation('invalid', now), false);
  assert.equal(isFreshDriverLocation(null, now), false);
});

test('distance calculation supports meter-scale movement and antipodal points', () => {
  const point = { latitude: -2.97, longitude: 104.75 };
  assert.equal(distanceMeters(point, point), 0);
  const distance = distanceMeters(point, { latitude: -2.969, longitude: 104.75 });
  assert.ok(distance > 111 && distance < 112);
  assert.ok(Number.isFinite(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 })));
});

test('browser GPS uses the browser watch ID and releases it on cleanup', async () => {
  const { watchDriverPosition } = require('../src/lib/driverGps.web.ts');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let emit, cleared, received, receivedError;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
    watchPosition: (callback, onError, options) => {
      emit = callback;
      assert.equal(options.enableHighAccuracy, true);
      assert.equal(options.maximumAge, 0);
      return 41;
    }, clearWatch: id => { cleared = id; },
  } } });
  try {
    const watcher = await watchDriverPosition(position => { received = position; }, error => { receivedError = error; });
    emit({ timestamp: 12345, coords: { latitude: -2.97, longitude: 104.75, accuracy: 5, altitude: null, altitudeAccuracy: null, heading: null, speed: null } });
    assert.equal(received.timestamp, 12345);
    assert.equal(received.coords.latitude, -2.97);
    assert.equal(receivedError, undefined);
    watcher.remove();
    assert.equal(cleared, 41);
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
  }
});
