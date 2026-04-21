/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      "colors": {
        "tertiary-fixed-dim": "#00e1ab",
        "inverse-primary": "#00677f",
        "on-primary-container": "#00566a",
        "tertiary-container": "#00daa5",
        "secondary-container": "#9d03de",
        "on-surface-variant": "#bbc9cf",
        "on-background": "#e5e2e3",
        "surface-dim": "#131314",
        "secondary-fixed": "#f6d9ff",
        "on-primary-fixed": "#001f28",
        "on-primary": "#003543",
        "surface": "#131314",
        "surface-container-high": "#2a2a2b",
        "surface-bright": "#3a393a",
        "primary-fixed-dim": "#4cd6ff",
        "on-tertiary-fixed-variant": "#00513c",
        "inverse-surface": "#e5e2e3",
        "on-primary-fixed-variant": "#004e60",
        "secondary": "#e8b3ff",
        "outline-variant": "#3c494e",
        "error-container": "#93000a",
        "tertiary": "#00f9be",
        "primary": "#a4e6ff",
        "on-secondary": "#500074",
        "on-secondary-fixed-variant": "#7200a3",
        "on-error-container": "#ffdad6",
        "secondary-fixed-dim": "#e8b3ff",
        "surface-container-highest": "#353436",
        "surface-container-low": "#1c1b1c",
        "tertiary-fixed": "#36ffc4",
        "surface-container": "#201f20",
        "outline": "#859399",
        "on-secondary-container": "#f5d6ff",
        "on-tertiary-fixed": "#002116",
        "on-tertiary-container": "#005a42",
        "on-secondary-fixed": "#310049",
        "primary-fixed": "#b7eaff",
        "primary-container": "#00d1ff",
        "on-error": "#690005",
        "on-surface": "#e5e2e3",
        "on-tertiary": "#003828",
        "surface-variant": "#353436",
        "background": "#131314",
        "surface-tint": "#4cd6ff",
        "surface-container-lowest": "#0e0e0f",
        "inverse-on-surface": "#313031",
        "error": "#ffb4ab"
      },
      "borderRadius": {
          "DEFAULT": "0.125rem",
          "lg": "0.25rem",
          "xl": "0.5rem",
          "full": "0.75rem"
      },
      "spacing": {
          "safe": "env(safe-area-inset-bottom)"
      },
      "fontFamily": {
          "headline": ["Space Grotesk", "sans-serif"],
          "body": ["Inter", "sans-serif"],
          "label": ["Space Grotesk", "monospace"]
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ],
}
