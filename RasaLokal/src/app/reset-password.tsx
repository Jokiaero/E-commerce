import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { AppIcon } from '@/components/AppIcon';
import { COLORS } from '@/constants/theme';
import { useHydrated } from '@/hooks/useHydrated';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import { INVALID_RECOVERY_MESSAGE, parseRecoveryLink, recoveryErrorMessage, requestPasswordReset, restoreRecoverySession, updateRecoveredPassword, type RecoveryIdentity, type RecoveryLink } from '@/lib/passwordRecovery';

type Stage = 'request' | 'verifying' | 'update' | 'sent' | 'done';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const hydrated = useHydrated();
  const recoveryLink: RecoveryLink = hydrated ? parseRecoveryLink(params) : { kind: 'none' };
  const callbackKey = JSON.stringify(recoveryLink);
  const [formStage, setStage] = useState<Stage>('request');
  const [handledCallbackKey, setHandledCallbackKey] = useState<string | null>(null);
  const stage: Stage = recoveryLink.kind !== 'none' && handledCallbackKey !== callbackKey ? 'verifying' : formStage;
  const [email, setEmail] = useState(Array.isArray(params.email) ? params.email[0] ?? '' : params.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [identity, setIdentity] = useState<RecoveryIdentity | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pendingRecovery = useRef<{ key: string; promise: Promise<RecoveryIdentity> } | null>(null);

  useEffect(() => {
    const link: RecoveryLink = JSON.parse(callbackKey);
    if (link.kind === 'none') return;
    let active = true;
    // Reuse the pending exchange if React runs the effect again in development.
    if (pendingRecovery.current?.key !== callbackKey) {
      pendingRecovery.current = { key: callbackKey, promise: Promise.resolve().then(() => {
        assertSupabaseConfigured();
        return restoreRecoverySession(supabase.auth, link);
      }) };
    }
    void pendingRecovery.current.promise.then((recoveredIdentity) => {
      if (!active) return;
      setIdentity(recoveredIdentity);
      setPassword('');
      setConfirmation('');
      setError('');
      setHandledCallbackKey(callbackKey);
      setStage('update');
    }).catch((recoveryError: unknown) => {
      if (!active) return;
      setIdentity(null);
      setPassword('');
      setConfirmation('');
      setError(recoveryErrorMessage(recoveryError));
      setHandledCallbackKey(callbackKey);
      setStage('request');
    }).finally(() => {
      // Keep recovery credentials out of the visible URL and browser history.
      if (active) {
        router.setParams({ '#': '', access_token: undefined, refresh_token: undefined, token_hash: undefined, code: undefined, sb_flow_id: undefined, type: undefined, error: undefined, error_code: undefined, error_description: undefined });
      }
    });
    return () => { active = false; };
  }, [callbackKey, router]);

  const openLogin = () => router.replace({ pathname: '/account-details', params: { section: 'login', authMode: 'signIn' } });

  const submit = async () => {
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      assertSupabaseConfigured();
      if (stage === 'update' && identity) {
        await updateRecoveredPassword(supabase.auth, identity, password, confirmation);
        setPassword('');
        setConfirmation('');
        setIdentity(null);
        setStage('done');
      } else if (stage === 'request') {
        await requestPasswordReset(supabase.auth, email, Linking.createURL('reset-password'));
        setStage('sent');
      }
    } catch (submitError: unknown) {
      const message = recoveryErrorMessage(submitError);
      setError(message);
      if (message === INVALID_RECOVERY_MESSAGE) {
        setIdentity(null);
        setPassword('');
        setConfirmation('');
        setStage('request');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const heading = stage === 'verifying' ? 'Memeriksa tautan...'
    : stage === 'update' ? 'Buat kata sandi baru'
      : stage === 'sent' ? 'Periksa emailmu'
        : stage === 'done' ? 'Kata sandi diperbarui' : 'Lupa kata sandi?';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={openLogin} accessibilityRole="button" accessibilityLabel="Kembali ke halaman masuk" disabled={submitting || stage === 'verifying'}>
          <AppIcon name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Reset kata sandi</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <View style={styles.introIcon}><AppIcon name={stage === 'done' ? 'checkmark-circle-outline' : 'person'} size={28} color={COLORS.primary} /></View>
          <Text style={styles.heading}>{heading}</Text>
          <Text style={styles.body}>{stage === 'update'
            ? `Buat kata sandi baru${identity?.email ? ` untuk ${identity.email}` : ' untuk akunmu'}.`
            : stage === 'sent' ? 'Jika email terdaftar, tautan pemulihan akan dikirim. Periksa kotak masuk dan folder spam, lalu buka tautan pada email terbaru.'
              : stage === 'done' ? 'Kata sandi baru berhasil disimpan. Kamu sudah masuk kembali ke akunmu.'
                : stage === 'verifying' ? 'Tunggu sebentar selagi kami memeriksa tautan pemulihanmu.'
                  : 'Masukkan email yang kamu gunakan saat mendaftar untuk menerima tautan pemulihan.'}</Text>
        </View>

        {stage === 'verifying' && <ActivityIndicator size="large" color={COLORS.primary} />}
        {error !== '' && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}

        {stage === 'request' && <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} accessibilityLabel="Email akun" value={email} onChangeText={setEmail} placeholder="nama@email.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" editable={!submitting} />
        </View>}

        {stage === 'update' && <>
          <View style={styles.field}>
            <Text style={styles.label}>Kata sandi baru</Text>
            <TextInput style={styles.input} accessibilityLabel="Kata sandi baru" value={password} onChangeText={setPassword} placeholder="Minimal 8 karakter" secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" editable={!submitting} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Konfirmasi kata sandi baru</Text>
            <TextInput style={styles.input} accessibilityLabel="Konfirmasi kata sandi baru" value={confirmation} onChangeText={setConfirmation} placeholder="Ulangi kata sandi baru" secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" editable={!submitting} />
          </View>
        </>}

        {(stage === 'request' || stage === 'update') && <Pressable style={[styles.button, submitting && styles.disabled]} onPress={() => void submit()} disabled={submitting} accessibilityRole="button" accessibilityState={{ disabled: submitting, busy: submitting }}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{stage === 'update' ? 'Simpan kata sandi baru' : 'Kirim tautan reset'}</Text>}
        </Pressable>}

        {stage === 'done' && <Pressable style={styles.button} onPress={() => router.replace('/(tabs)/profile')} accessibilityRole="button"><Text style={styles.buttonText}>Ke akun saya</Text></Pressable>}
        {stage === 'sent' && <Pressable style={styles.textButton} onPress={() => { setError(''); setStage('request'); }} accessibilityRole="button"><Text style={styles.textButtonText}>Gunakan email lain</Text></Pressable>}
        {stage !== 'verifying' && stage !== 'done' && <Pressable style={styles.textButton} onPress={openLogin} disabled={submitting} accessibilityRole="button"><Text style={styles.textButtonText}>Kembali ke halaman masuk</Text></Pressable>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  content: { padding: 22, paddingBottom: 36, width: '100%', maxWidth: 480, alignSelf: 'center' },
  intro: { alignItems: 'center', paddingVertical: 22, gap: 12 },
  introIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: COLORS.orange50, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 22, lineHeight: 29, fontWeight: '900', color: COLORS.text, textAlign: 'center' },
  body: { fontSize: 13, lineHeight: 20, color: COLORS.secondaryText, textAlign: 'center' },
  field: { marginTop: 16 },
  label: { marginBottom: 8, fontSize: 12, fontWeight: '800', color: COLORS.text },
  input: { minHeight: 50, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, color: COLORS.text, fontSize: 14 },
  error: { padding: 13, marginTop: 8, borderRadius: 10, backgroundColor: COLORS.orange50, color: COLORS.danger, fontSize: 12, lineHeight: 18 },
  button: { minHeight: 50, marginTop: 24, padding: 14, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  textButton: { minHeight: 44, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  textButtonText: { color: COLORS.primary, fontSize: 12, fontWeight: '800' },
});
