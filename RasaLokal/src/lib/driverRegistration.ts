export type DriverAccount = { userId: string; name: string; phone: string; vehicle: string; active: boolean };
export type DriverAccess =
  | { kind: 'guest' }
  | { kind: 'unregistered'; userId: string; name: string; phone: string }
  | { kind: 'pending' | 'active'; driver: DriverAccount };
export type DriverAccountRow = { user_id: string; name: string; phone: string; vehicle: string; active: boolean };
export type DriverRegistrationInput = { name: string; phone: string; vehicleType: string; plateNumber: string };

export function driverAccessFromRow(user: { id: string; user_metadata?: Record<string, unknown> } | null, row: DriverAccountRow | null): DriverAccess {
  if (!user) return { kind: 'guest' };
  if (!row) return {
    kind: 'unregistered', userId: user.id,
    name: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : '',
    phone: typeof user.user_metadata?.phone === 'string' ? user.user_metadata.phone : '',
  };
  if (row.user_id !== user.id) throw new Error('Data akun driver tidak sesuai. Muat ulang halaman.');
  const active = row.active === true;
  return { kind: active ? 'active' : 'pending', driver: { userId: row.user_id, name: row.name, phone: row.phone, vehicle: row.vehicle, active } };
}

export function validateDriverRegistration(input: DriverRegistrationInput): DriverRegistrationInput {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const digits = phone.replace(/\D/g, '');
  const plateNumber = input.plateNumber.trim().toUpperCase().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) throw new Error('Isi nama lengkap antara 2 hingga 80 karakter.');
  if (!/^\+?[\d\s()-]+$/.test(phone) || digits.length < 8 || digits.length > 15 || phone.length > 24) {
    throw new Error('Masukkan nomor telepon yang valid.');
  }
  if (input.vehicleType !== 'Motor' && input.vehicleType !== 'Mobil') throw new Error('Pilih jenis kendaraan.');
  if (plateNumber.length < 3 || plateNumber.length > 20 || !/^[A-Z0-9 -]+$/.test(plateNumber) || !/[A-Z]/.test(plateNumber) || !/\d/.test(plateNumber)) {
    throw new Error('Isi nomor polisi yang valid, contoh BG 1234 AB.');
  }
  return { name, phone, vehicleType: input.vehicleType, plateNumber };
}
