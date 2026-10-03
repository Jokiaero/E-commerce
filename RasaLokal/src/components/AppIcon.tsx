import { SymbolView } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

type Props = {
  name: string;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
};

const ICONS: Record<string, { ios: string; android: string; web: string }> = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  storefront: { ios: 'storefront.fill', android: 'storefront', web: 'storefront' },
  cart: { ios: 'cart.fill', android: 'shopping_cart', web: 'shopping_cart' },
  receipt: { ios: 'receipt.fill', android: 'receipt_long', web: 'receipt_long' },
  person: { ios: 'person.fill', android: 'person', web: 'person' },
  'chevron-forward': { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  'chevron-back': { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  'chevron-down': { ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  remove: { ios: 'minus', android: 'remove', web: 'remove' },
  restaurant: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' },
  'arrow-forward': { ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' },
  location: { ios: 'location.fill', android: 'location_on', web: 'location_on' },
  'location-outline': { ios: 'location', android: 'location_on', web: 'location_on' },
  'notifications-outline': { ios: 'bell', android: 'notifications', web: 'notifications' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  grid: { ios: 'square.grid.2x2', android: 'grid_view', web: 'grid_view' },
  cafe: { ios: 'cup.and.saucer.fill', android: 'local_cafe', web: 'local_cafe' },
  'fast-food': { ios: 'takeoutbag.and.cup.and.straw.fill', android: 'fastfood', web: 'fastfood' },
  gift: { ios: 'gift.fill', android: 'card_giftcard', web: 'card_giftcard' },
  star: { ios: 'star.fill', android: 'star', web: 'star' },
  'bag-check': { ios: 'bag.badge.checkmark', android: 'shopping_bag', web: 'shopping_bag' },
  checkbox: { ios: 'checkmark.square.fill', android: 'check_box', web: 'check_box' },
  heart: { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
  'heart-outline': { ios: 'heart', android: 'favorite_border', web: 'favorite_border' },
  'checkmark-circle-outline': { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' },
  bicycle: { ios: 'bicycle', android: 'directions_bike', web: 'directions_bike' },
  call: { ios: 'phone.fill', android: 'call', web: 'call' },
  'create-outline': { ios: 'pencil', android: 'edit', web: 'edit' },
  'add-circle-outline': { ios: 'plus.circle', android: 'add_circle', web: 'add_circle' },
  'radio-button-on': { ios: 'circle.inset.filled', android: 'radio_button_checked', web: 'radio_button_checked' },
  'radio-button-off': { ios: 'circle', android: 'radio_button_unchecked', web: 'radio_button_unchecked' },
  'business-outline': { ios: 'building.2', android: 'business', web: 'business' },
  'wallet-outline': { ios: 'creditcard', android: 'account_balance_wallet', web: 'account_balance_wallet' },
  'cash-outline': { ios: 'banknote', android: 'payments', web: 'payments' },
  'card-outline': { ios: 'creditcard', android: 'credit_card', web: 'credit_card' },
  'help-circle-outline': { ios: 'questionmark.circle', android: 'help_outline', web: 'help_outline' },
  'information-circle-outline': { ios: 'info.circle', android: 'info_outline', web: 'info_outline' },
};

export function AppIcon({ name, size = 24, color = '#171717', style }: Props) {
  const icon = ICONS[name] ?? { ios: 'circle', android: 'circle', web: 'circle' };
  return (
    <SymbolView
      name={icon as any}
      size={size}
      tintColor={color}
      resizeMode="scaleAspectFit"
      style={style}
    />
  );
}
