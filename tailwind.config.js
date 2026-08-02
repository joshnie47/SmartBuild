/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#F0F4F8',
          100: '#DCE5EF',
          200: '#B7C7DB',
          300: '#8AA3BE',
          400: '#5C7BA0',
          500: '#3D5C82',
          600: '#1E3A5F',
          700: '#162F4D',
          800: '#0F2440',
          900: '#081830',
        },
        amber: {
          50: '#FEF6E7',
          100: '#FDE9C2',
          200: '#FBD58A',
          300: '#F9C153',
          400: '#F5A623',
          500: '#E0920F',
          600: '#B5750A',
          700: '#8A5908',
        },
        gray: {
          50: '#F9FAFB',
          100: '#F4F5F7',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '12px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        soft: '0 1px 3px rgba(30, 58, 95, 0.06), 0 1px 2px rgba(30, 58, 95, 0.04)',
        card: '0 2px 8px rgba(30, 58, 95, 0.06), 0 0 1px rgba(30, 58, 95, 0.08)',
        float: '0 8px 24px rgba(30, 58, 95, 0.12)',
      },
      keyframes: {
        pulseAmber: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245, 166, 35, 0.5)' },
          '50%': { boxShadow: '0 0 0 10px rgba(245, 166, 35, 0)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        pulseAmber: 'pulseAmber 2s ease-in-out infinite',
        fadeIn: 'fadeIn 0.3s ease-out',
        scaleIn: 'scaleIn 0.2s ease-out',
        shimmer: 'shimmer 1.5s linear infinite',
      },
    },
  },
  plugins: [],
};
