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
      // Variable font — same file for bold (renders correctly)
      { src: path.join(fontsDir, "NotoSansSC-Regular.ttf"), fontWeight: "bold" },
    ],
  });
}
