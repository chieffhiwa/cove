import { createContext, useContext } from "react";
import { LIGHT } from "../config/palette";

export const ThemeContext = createContext(LIGHT);
export const useTheme = () => useContext(ThemeContext);
