/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#3454D1",
        primaryDark: "#2739a3",
        surface: "#F5F7FB",
        borderColor: "#D8DEEB",
      },
    },
  },
  plugins: [],
};
