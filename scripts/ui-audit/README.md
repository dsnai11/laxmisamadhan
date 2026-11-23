# UI audit (phone / tablet / desktop, light + dark)

Walks all 23 screens inside the real Android app (sign in first on the emulator) and reports:
sideways scrolling, elements off-screen, clipped text, low text contrast, small tap targets.
Run it after UI changes, before a Play Store release. Gradient banners can show as false
low-contrast; check those by eye. For dark mode, run with `document.documentElement.classList.add('dark');`
prepended to audit_app.js. For tablet: `adb shell wm size 1600x2560; adb shell wm density 320` (reset afterwards).
