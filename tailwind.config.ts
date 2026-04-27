import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07090d",
          900: "#0b0f16",
          850: "#101620",
          800: "#151d29",
          700: "#222d3c",
        },
        mist: {
          50: "#f8f5ee",
          100: "#e9e6dc",
          300: "#b4bbc5",
          500: "#7e8795",
          700: "#4b5565",
        },
        teal: {
          300: "#75e0d6",
          400: "#35c8bd",
          500: "#17a99f",
        },
        violet: {
          300: "#b8a6ff",
          400: "#8f7bff",
          500: "#7157f2",
        },
        ember: {
          300: "#ffd189",
          400: "#f6ae4f",
        },
      },
      boxShadow: {
        glow: "0 24px 80px rgba(53, 200, 189, 0.16)",
        soft: "0 20px 60px rgba(0, 0, 0, 0.32)",
      },
      backgroundImage: {
        "app-shell":
          "linear-gradient(135deg, rgba(7, 9, 13, 1) 0%, rgba(13, 17, 25, 1) 44%, rgba(19, 22, 32, 1) 100%)",
        "panel-sheen":
          "linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.035))",
        "accent-line":
          "linear-gradient(90deg, rgba(117,224,214,1), rgba(184,166,255,1), rgba(255,209,137,1))",
      },
    },
  },
  plugins: [],
};

export default config;
