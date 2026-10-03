# RasaLokal - React Native / Expo conversion

This folder is a drop-in replacement for the `src` folder of the Expo SDK 57 project you already created with `create-expo-app`.

## What is included

- Splash screen
- Home / Beranda
- UMKM list
- Product detail
- Cart
- Checkout and payment selection
- Order list
- Order tracking
- Profile placeholder
- Expo Router navigation and bottom tabs

The design is converted from the HTML prototype files in `Aplikasi E-commerce.zip` into native React Native components.

## Install into your existing project

1. Stop Expo in the VS Code terminal with `Ctrl + C`.
2. Open your existing `RasaLokal` project.
3. Rename the existing `src` folder to `src-backup` so it is easy to restore.
4. Copy the `src` folder from this converted package into the root of your existing `RasaLokal` project.
5. Do not copy `node_modules` and do not run `npm audit fix --force`.
6. Run:

```powershell
npx expo start -c
```

7. Scan the QR code with Expo Go on the iPhone.

## Required packages

This source uses only packages normally included in the default Expo Router template:

- expo-router
- react-native
- react-native-safe-area-context
- expo-status-bar
- @expo/vector-icons

If VS Code reports that `@expo/vector-icons` is missing, run:

```powershell
npx expo install @expo/vector-icons
```

## Important

The current version is a UI prototype. Cart data, checkout, login, payment, tracking location and user accounts are still mock/static data. They can later be connected to a real backend/API.

The food images currently use the same remote image URLs from the original HTML prototype, so the iPhone needs internet access to display them.
