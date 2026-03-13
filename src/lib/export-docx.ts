import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from "docx";
import { saveAs } from "file-saver";
import type { Exhibit } from "./contract-types";

function parseContentToParagraphs(text: string): Paragraph[] {
  const lines = text.split("\n");
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty line = spacing
    if (trimmed === "") {
      paragraphs.push(new Paragraph({ text: "" }));
      continue;
    }

    // Signature lines
    if (trimmed.startsWith("_____")) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 200 },
          children: [
            new TextRun({
              text: "_".repeat(40),
              font: "Times New Roman",
              size: 24,
            }),
          ],
        })
      );
      continue;
    }

    // All-caps lines (section headers like "SERVICE AGREEMENT", "SERVICE PROVIDER:", etc.)
    if (
      trimmed === trimmed.toUpperCase() &&
      trimmed.length > 3 &&
      /[A-Z]/.test(trimmed)
    ) {
      // Main title (first all-caps line or very prominent)
      const isTitle = !trimmed.includes(":") && !trimmed.match(/^\d+\./);
      paragraphs.push(
        new Paragraph({
          alignment: isTitle ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { before: isTitle ? 0 : 200, after: isTitle ? 200 : 100 },
          children: [
            new TextRun({
              text: trimmed,
              bold: true,
              font: "Times New Roman",
              size: isTitle ? 28 : 24,
            }),
          ],
        })
      );
      continue;
    }

    // Numbered sections (e.g. "1. SERVICES")
    if (/^\d+\./.test(trimmed)) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 240, after: 120 },
          children: [
            new TextRun({
              text: trimmed,
              bold: true,
              font: "Times New Roman",
              size: 24,
            }),
          ],
        })
      );
      continue;
    }

    // Lettered items (a), b), etc.)
    if (/^[a-z]\)/.test(trimmed)) {
      paragraphs.push(
        new Paragraph({
          indent: { left: 720 },
          spacing: { before: 60 },
          children: [
            new TextRun({
              text: trimmed,
              font: "Times New Roman",
              size: 24,
            }),
          ],
        })
      );
      continue;
    }

    // Regular text
    paragraphs.push(
      new Paragraph({
        spacing: { before: 60 },
        children: [
          new TextRun({
            text: trimmed,
            font: "Times New Roman",
            size: 24,
          }),
        ],
      })
    );
  }

  return paragraphs;
}

export async function exportToDocx(
  content: string,
  fileName: string,
  exhibits?: Exhibit[],
  renderedExhibitContents?: string[]
) {
  const mainParagraphs = parseContentToParagraphs(content);

  // Add exhibits
  const exhibitParagraphs: Paragraph[] = [];
  if (exhibits && exhibits.length > 0) {
    for (let i = 0; i < exhibits.length; i++) {
      const exhibit = exhibits[i];
      const exhibitContent = renderedExhibitContents?.[i] || exhibit.content;

      // Page break before exhibit
      exhibitParagraphs.push(
        new Paragraph({
          pageBreakBefore: true,
          children: [],
        })
      );

      // Exhibit header with border
      exhibitParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
          },
          children: [
            new TextRun({
              text: `${exhibit.label}: ${exhibit.title}`,
              bold: true,
              font: "Times New Roman",
              size: 28,
            }),
          ],
        })
      );

      // Exhibit content
      exhibitParagraphs.push(...parseContentToParagraphs(exhibitContent));
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: [...mainParagraphs, ...exhibitParagraphs],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = fileName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "contract";
  saveAs(blob, `${safeName}.docx`);
}
