import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#17211c",
        leaf: "#34785f",
        mint: "#e4f4ec",
        citrus: "#f8c04f",
        berry: "#b65973",
        skyglass: "#eaf4ff"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(20, 35, 30, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
