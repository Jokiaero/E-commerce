import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { driverAccessFromRow, validateDriverRegistration, type DriverAccess, type DriverAccountRow, type DriverRegistrationInput } from '@/lib/driverRegistration';

function driverAccountError(error: { code?: string; message: string }): Error {
  return new Error(['PGRST202', 'PGRST205', '42P01'].includes(error.code ?? '')
    ? 'Layanan pendaftaran driver belum tersedia. Hubungi admin.' : error.message);
}

export async function loadDriverAccess(): Promise<DriverAccess> {
  if (!isSupabaseConfigured) throw new Error('Layanan akun belum tersedia. Coba lagi nanti.');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) return { kind: 'guest' };
  const { data, error } = await supabase.from('delivery_drivers').select('user_id, name, phone, vehicle, active').eq('user_id', user.id).maybeSingle();
  if (error) throw driverAccountError(error);
  return driverAccessFromRow(user, data as DriverAccountRow | null);
}

export async function registerDriverAccount(expectedUserId: string, input: DriverRegistrationInput): Promise<DriverAccess> {
  const values = validateDriverRegistration(input);
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!data.session?.user || data.session.user.id !== expectedUserId) throw new Error('Akun berubah. Muat ulang halaman sebelum mendaftar.');
  const { error } = await supabase.rpc('register_driver_account', {
    p_name: values.name, p_phone: values.phone, p_vehicle_type: values.vehicleType, p_plate_number: values.plateNumber,
  });
  if (error) throw driverAccountError(error);
  const access = await loadDriverAccess();
  if (access.kind !== 'pending' && access.kind !== 'active') throw new Error('Pendaftaran belum dapat dikonfirmasi. Muat ulang halaman.');
  return access;
}
