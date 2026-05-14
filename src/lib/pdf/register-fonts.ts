import { Font } from "@react-pdf/renderer";
import path from "path";

let registered = false;

export function registerFonts() {
  if (registered) return;
  registered = true;

  const fontsDir = path.join(process.cwd(), "public", "fonts");

  Font.register({
    family: "NotoSansSC",
    fonts: [
      { src: path.join(fontsDir, "NotoSansSC-Regular.ttf"), fontWeight: "normal" },
      { src: path.join(fontsDir, "NotoSansSC-Bold.otf"), fontWeight: "bold" },
    ],
  });
}
