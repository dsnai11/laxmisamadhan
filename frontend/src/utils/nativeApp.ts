import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
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
    await SystemBars.setStyle({
      style: isDarkMode ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
    });
  } catch (err) {
    console.debug('SystemBars styling not supported:', err);
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
