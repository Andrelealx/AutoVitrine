module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Playfair Display'", "serif"],
        body: ["'Manrope'", "sans-serif"]
      },
      colors: {
        base: {
          950: "#08080A",
          900: "#0E0F13",
          800: "#171820"
        },
        gold: {
          200: "#FBE7AE",
          300: "#E7C875",
          400: "#D4A845",
          500: "#B98C2A"
        }
      },
      boxShadow: {
        luxe: "0 16px 60px -24px rgba(212, 168, 69, 0.45)"
      },
      backgroundImage: {
        grid: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)"
      }
    }
  },
  plugins: []
};