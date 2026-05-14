export const lightTheme = {
  background: "#FFFFFF",
  text: "#000000",
  input: "#F2F2F2",
  card: "#FFFFFF",
  border: "#E0E0E0",
  primary: "#3B82F6",     // add more colors as needed
  // ... add more colors you use in the app
};

export const darkTheme = {
  background: "#121212",
  text: "#FFFFFF",
  input: "#1E1E1E",
  card: "#1E1E1E",
  border: "#333333",
  primary: "#60A5FA",
  // ... match the same keys as lightTheme
};

export type Theme = typeof lightTheme;