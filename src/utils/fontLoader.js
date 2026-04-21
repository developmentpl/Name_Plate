// Loads locally bundled fonts (from /public/fonts/) + Google Noto fallbacks for Devanagari.
//
// Local fonts are declared in /public/fonts/manifest.json. To add a new font:
//   1. Drop the file into public/fonts/ (preferably .woff2)
//   2. Add an entry to manifest.json
//   3. Refresh the app — it will appear in the dropdown

const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2' +
  '?family=Noto+Sans:wght@400;700' +
  '&family=Noto+Sans+Devanagari:wght@400;700' +
  '&display=swap';

let fontLoadPromise = null;
let availableFonts = [];   // filled in by loadFonts()

export function getAvailableFonts() {
  // Always include the built-in Noto stacks so users have working defaults
  const builtins = [
    { name: 'Auto (matches script)', value: 'auto', supports: ['english', 'devanagari'] },
    { name: 'Noto Sans', value: 'Noto Sans', supports: ['english'] },
    { name: 'Noto Sans Devanagari', value: 'Noto Sans Devanagari', supports: ['devanagari'] },
  ];
  return [...builtins, ...availableFonts];
}

export function loadFonts() {
  if (fontLoadPromise) return fontLoadPromise;
  fontLoadPromise = (async () => {
    // 1. Google Fonts (Noto Sans + Noto Sans Devanagari) via stylesheet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);

    // 2. Local fonts from the manifest
    try {
      const res = await fetch('/fonts/manifest.json');
      if (res.ok) {
        const manifest = await res.json();
        const styleLines = [];
        for (const entry of manifest) {
          for (const variant of entry.variants) {
            const weight = variant.weight || 400;
            const fontPath = `/fonts/${variant.file}`;
            const format = variant.file.endsWith('.woff2') ? 'woff2'
                         : variant.file.endsWith('.woff') ? 'woff'
                         : variant.file.endsWith('.ttf') ? 'truetype'
                         : 'truetype';
            styleLines.push(
              `@font-face {` +
              `  font-family: "${entry.name}";` +
              `  src: url("${fontPath}") format("${format}");` +
              `  font-weight: ${weight};` +
              `  font-style: normal;` +
              `  font-display: swap;` +
              `}`
            );
          }
          availableFonts.push({
            name: entry.name,
            value: entry.name,
            supports: entry.supports || ['english'],
          });
        }
        if (styleLines.length > 0) {
          const styleEl = document.createElement('style');
          styleEl.textContent = styleLines.join('\n');
          document.head.appendChild(styleEl);
        }
      }
    } catch (err) {
      console.warn('Could not load local fonts manifest:', err);
    }

    // 3. Trigger actual font loading so they are ready for canvas
    if (document.fonts && document.fonts.load) {
      const loaders = [
        document.fonts.load('400 16px "Noto Sans"'),
        document.fonts.load('700 16px "Noto Sans"'),
        document.fonts.load('400 16px "Noto Sans Devanagari"'),
        document.fonts.load('700 16px "Noto Sans Devanagari"'),
      ];
      for (const f of availableFonts) {
        loaders.push(document.fonts.load(`400 16px "${f.name}"`));
        loaders.push(document.fonts.load(`700 16px "${f.name}"`));
      }
      try {
        await Promise.all(loaders);
      } catch {
        // Individual font failures shouldn't block the app
      }
    } else {
      await new Promise((r) => setTimeout(r, 1500));
    }

    return true;
  })();
  return fontLoadPromise;
}

/**
 * Detect if a string contains Devanagari characters (Marathi / Hindi).
 * Unicode range U+0900 to U+097F is Devanagari.
 */
export function hasDevanagari(text) {
  if (!text) return false;
  return /[\u0900-\u097F]/.test(text);
}

/**
 * Pick the best font stack.
 * - If explicit font chosen (not 'auto'), use it with smart fallbacks.
 * - If 'auto', pick based on the text's script.
 */
export function fontStackFor(text, chosenFont = 'auto') {
  const isDeva = hasDevanagari(text);

  if (!chosenFont || chosenFont === 'auto') {
    // Automatic: pick based on script
    if (isDeva) {
      return '"Noto Sans Devanagari", "Tiro Devanagari Marathi", "Kalam", Arial, sans-serif';
    }
    return '"Poppins", "Noto Sans", Arial, sans-serif';
  }

  // User picked a specific font. Always include fallbacks so weird characters still render.
  // If the text contains Devanagari and the chosen font may not support it, fallback to Noto.
  const chosenInfo = [...getAvailableFonts()].find((f) => f.value === chosenFont);
  const supportsDeva = chosenInfo?.supports?.includes('devanagari');
  if (isDeva && !supportsDeva) {
    return `"${chosenFont}", "Noto Sans Devanagari", "Tiro Devanagari Marathi", Arial, sans-serif`;
  }
  return `"${chosenFont}", "Noto Sans", Arial, sans-serif`;
}
