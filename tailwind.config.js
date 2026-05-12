import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./Views/**/*.cshtml', './wwwroot/app/react/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#14152D',
          cyan: '#43C7F4',
          purple: '#606DB4',
        },
        surface: {
          white: '#ffffff',
          light: '#f6f8fa',
          cream: '#fafbfc',
        },
        border: {
          DEFAULT: '#e8ecf1',
          light: '#f1f5f9',
        },
        text: {
          primary: '#0d0c2c',
          secondary: '#374151',
          muted: '#4b5563',
        },
        success: { DEFAULT: '#10b981', bg: '#d1fae5' },
        warning: { DEFAULT: '#f59e0b', bg: '#fef3c7' },
        error: { DEFAULT: '#ef4444', bg: '#fee2e2' },
        badge: {
          'blue-bg': '#dbeafe',
          'blue-text': '#1e40af',
          'green-bg': '#d1fae5',
          'green-text': '#065f46',
          'purple-bg': '#ede9fe',
          'purple-text': '#5b21b6',
        },
        np: {
          bg: '#f6f8fa',
          card: '#ffffff',
          border: '#e8ecf1',
          accent: '#43C7F4',
          btn: '#43C7F4',
          hover: '#f6f8fa',
          sidebar: '#14152D',
          green: '#10b981',
          red: '#ef4444',
          amber: '#f59e0b',
          text: '#0d0c2c',
          muted: '#4b5563',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 14, 37, 0.05)',
        md: '0 2px 8px rgba(0, 14, 37, 0.08)',
        lg: '0 4px 12px rgba(0, 14, 37, 0.12)',
        'cyan-glow': '0 4px 12px rgba(67, 199, 244, 0.3)',
      },
    },
  },
  plugins: [forms],
};
