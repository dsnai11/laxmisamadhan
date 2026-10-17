import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const isNative = Capacitor.isNativePlatform();
export const getPlatform = () => Capacitor.getPlatform(); // 'ios', 'android', 'web'

export const initNativeApp = async (isDarkMode: boolean) => {
  if (!isNative) return;

  try {
    // Configure Keyboard resize
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
  } catch (err) {
    console.debug('Keyboard plugin not available:', err);
  }

  // Configure Status Bar
  await updateNativeStatusBar(isDarkMode);
};

export const updateNativeStatusBar = async (isDarkMode: boolean) => {
  if (!isNative) return;

  try {
    const platform = getPlatform();

    if (platform === 'android') {
      // On Android, use dark background with light icons in dark mode, or light background with dark icons in light mode
      await StatusBar.setStyle({
        style: isDarkMode ? Style.Dark : Style.Light,
      });
      await StatusBar.setBackgroundColor({
        color: isDarkMode ? '#0f172a' : '#ffffff',
      });
      await StatusBar.setOverlaysWebView({ overlay: false });
    } else if (platform === 'ios') {
      // On iOS, set status bar text style to match the theme
      await StatusBar.setStyle({
        style: isDarkMode ? Style.Dark : Style.Light,
      });
    }
  } catch (err) {
    console.debug('StatusBar styling not supported:', err);
  }
};

export const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Light) => {
  if (!isNative) return;

  try {
    await Haptics.impact({ style });
  } catch (err) {
    // Haptics not available or user disabled
  }
};
