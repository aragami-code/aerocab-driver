import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { COLORS, SPACING, BORDER_RADIUS } from '@aerocab/shared';
import { Check, LogOut, ChevronRight } from 'lucide-react-native';
import { Button, Input } from '@aerocab/mobile-ui';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

export default function DriverSettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (token) loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getDriverProfile(token!);
      setVehicleBrand(data.vehicleBrand || '');
      setVehicleModel(data.vehicleModel || '');
      setVehicleColor(data.vehicleColor || '');
      setVehiclePlate(data.vehiclePlate || '');
    } catch {
      // Ignore
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.updateDriverProfile(token!, {
        vehicleBrand: vehicleBrand.trim(),
        vehicleModel: vehicleModel.trim(),
        vehicleColor: vehicleColor.trim(),
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
      });
      setSuccess('Profil mis a jour avec succes');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Echec de la mise a jour';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login' as never);
  };

  const initials = user?.name ? user.name.charAt(0).toUpperCase() : '?';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerBg}>
        <Text style={styles.headerTitle}>Mon profil chauffeur</Text>
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.userName}>{user?.name || 'Chauffeur'}</Text>
        <Text style={styles.userPhone}>{user?.phone || ''}</Text>
      </View>

      {/* Vehicle info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informations vehicule</Text>
        <View style={styles.formCard}>
          <Input
            label="Marque"
            placeholder="Ex: Toyota"
            value={vehicleBrand}
            onChangeText={(t) => {
              setVehicleBrand(t);
              setError('');
              setSuccess('');
            }}
          />
          <Input
            label="Modele"
            placeholder="Ex: Corolla"
            value={vehicleModel}
            onChangeText={(t) => {
              setVehicleModel(t);
              setError('');
              setSuccess('');
            }}
          />
          <Input
            label="Couleur"
            placeholder="Ex: Gris"
            value={vehicleColor}
            onChangeText={(t) => {
              setVehicleColor(t);
              setError('');
              setSuccess('');
            }}
          />
          <Input
            label="Plaque"
            placeholder="Ex: LT 1234 AB"
            value={vehiclePlate}
            onChangeText={(t) => {
              setVehiclePlate(t);
              setError('');
              setSuccess('');
            }}
            autoCapitalize="characters"
          />

          {success ? (
            <View style={styles.successBanner}>
              <Check size={16} color={COLORS.success} />
              <Text style={styles.successText}>{success}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button
            title="Enregistrer"
            onPress={handleSave}
            loading={loading}
            style={{ marginTop: SPACING.xs }}
          />
        </View>
      </View>

      {/* Logout */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Compte</Text>
        <Pressable style={styles.menuItem} onPress={handleLogout}>
          <View style={styles.menuItemLeft}>
            <View style={[styles.menuIcon, styles.menuIconDanger]}>
              <LogOut size={18} color={COLORS.error} />
            </View>
            <View>
              <Text style={styles.menuItemLabel}>Deconnexion</Text>
              <Text style={styles.menuItemHint}>
                Se deconnecter de votre compte
              </Text>
            </View>
          </View>
          <ChevronRight size={22} color={COLORS.grayMedium} />
        </Pressable>
      </View>

      <Text style={styles.versionText}>AeroCab Pro v0.1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerBg: {
    backgroundColor: COLORS.primary,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: 48,
    paddingHorizontal: SPACING.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
    textAlign: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: -36,
    marginBottom: SPACING.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: COLORS.white,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: SPACING.sm,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 13,
    color: COLORS.grayMedium,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.grayMedium,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.success}12`,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.button,
    marginBottom: SPACING.sm,
    gap: 8,
  },
  successText: {
    color: COLORS.success,
    fontSize: 13,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: `${COLORS.error}10`,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.button,
    marginBottom: SPACING.sm,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconDanger: {
    backgroundColor: `${COLORS.error}10`,
  },
  menuItemLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.black,
  },
  menuItemHint: {
    fontSize: 12,
    color: COLORS.grayMedium,
    marginTop: 1,
  },
  versionText: {
    fontSize: 12,
    color: COLORS.grayMedium,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
