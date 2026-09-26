/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './src/**/*.{js,jsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        angola: {
          black: '#000000',
          red: '#CE1126',
          redDark: '#9B0C1C',
          redBright: '#E50914',
          gold: '#F7D417',
          goldMuted: '#C9A912',
          surface: '#0A0A0A',
          elevated: '#141414',
          border: '#2A2A2A',
          muted: '#8C8C8C',
          text: '#FFFFFF',
          textSecondary: '#B3B3B3',
        },
      },
      fontFamily: {
        display: ['System'],
        body: ['System'],
      },
      aspectRatio: {
        video: '16 / 9',
      },
    },
  },
  plugins: [],
};
