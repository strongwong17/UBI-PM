export function openStyledPrintWindow(content: string, title: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const styledHtml = convertToStyledHtml(content, title);
  printWindow.document.write(styledHtml);
  printWindow.document.close();
  printWindow.print();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function convertToStyledHtml(content: string, title: string): string {
  const lines = content.split("\n");
  let bodyHtml = "";
  let isFirstHeading = true;
  let consecutiveEmpty = 0;
  let lastWasExhibitTitle = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line — collapse consecutive empties to max 1 spacer
    if (trimmed === "") {
      consecutiveEmpty++;
      if (consecutiveEmpty <= 1) {
        bodyHtml += `<div class="spacer"></div>`;
      }
      continue;
    }
    consecutiveEmpty = 0;

    // Separator lines (====) — skip if right after exhibit title to avoid empty page
    if (/^={5,}$/.test(trimmed)) {
      if (!lastWasExhibitTitle) {
        bodyHtml += `<hr class="exhibit-divider" />`;
      }
      lastWasExhibitTitle = false;
      continue;
    }

    lastWasExhibitTitle = false;

    // Signature lines (_____)
    if (/^_{5,}$/.test(trimmed)) {
      bodyHtml += `<div class="signature-line"></div>`;
      continue;
    }

    // Lines that are just "Date: ___"
    if (/^Date:\s*_+$/.test(trimmed)) {
      bodyHtml += `<div class="date-line">Date: <span class="date-underline"></span></div>`;
      continue;
    }

    // Main title: first all-caps line that's the document title
    if (
      isFirstHeading &&
      trimmed === trimmed.toUpperCase() &&
      trimmed.length > 3 &&
      /[A-Z]/.test(trimmed) &&
      !trimmed.includes(":") &&
      !trimmed.match(/^\d+\./)
    ) {
      isFirstHeading = false;
      bodyHtml += `<h1 class="doc-title">${escapeHtml(trimmed)}</h1>`;
      continue;
    }

    // Exhibit header: "Exhibit A: Title"
    if (/^Exhibit\s+[A-Z]:/i.test(trimmed)) {
      bodyHtml += `<h1 class="exhibit-title">${escapeHtml(trimmed)}</h1>`;
      lastWasExhibitTitle = true;
      continue;
    }

    // Section headers: all-caps with colon (e.g. "SERVICE PROVIDER:", "PARTIES:")
    if (
      trimmed === trimmed.toUpperCase() &&
      trimmed.length > 2 &&
      /[A-Z]/.test(trimmed) &&
      trimmed.endsWith(":") &&
      !trimmed.match(/^\d+\./)
    ) {
      bodyHtml += `<h3 class="section-label">${escapeHtml(trimmed)}</h3>`;
      continue;
    }

    // All-caps lines (sub-titles like "IN WITNESS WHEREOF", "APPROVED BY:")
    if (
      trimmed === trimmed.toUpperCase() &&
      trimmed.length > 3 &&
      /[A-Z]/.test(trimmed) &&
      !trimmed.match(/^\d+\./)
    ) {
      bodyHtml += `<h2 class="sub-title">${escapeHtml(trimmed)}</h2>`;
      continue;
    }

    // Numbered sections: "1. SERVICES", "10. ENTIRE AGREEMENT"
    if (/^\d+\.\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+\.)\s+(.*)$/);
      if (match) {
        bodyHtml += `<h3 class="numbered-section"><span class="section-num">${escapeHtml(match[1])}</span> ${escapeHtml(match[2])}</h3>`;
        continue;
      }
    }

    // Lettered items: a), b), c), d)
    if (/^[a-z]\)\s/.test(trimmed)) {
      bodyHtml += `<p class="lettered-item">${escapeHtml(trimmed)}</p>`;
      continue;
    }

    // Milestone / indented items (lines starting with spaces like "  Due Date:")
    if (line.startsWith("  ") && trimmed.includes(":")) {
      const [label, ...rest] = trimmed.split(":");
      const value = rest.join(":").trim();
      bodyHtml += `<p class="detail-item"><span class="detail-label">${escapeHtml(label)}:</span> ${escapeHtml(value)}</p>`;
      continue;
    }

    // Label: value lines (e.g. "Address: 123 Main St", "Email: foo@bar.com")
    if (
      /^[A-Z][A-Za-z\s\/]+:\s/.test(trimmed) &&
      trimmed.indexOf(":") < 30
    ) {
      const colonIdx = trimmed.indexOf(":");
      const label = trimmed.slice(0, colonIdx);
      const value = trimmed.slice(colonIdx + 1).trim();
      bodyHtml += `<p class="field-line"><span class="field-label">${escapeHtml(label)}:</span> ${escapeHtml(value)}</p>`;
      continue;
    }

    // Default paragraph
    bodyHtml += `<p class="body-text">${escapeHtml(trimmed)}</p>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: letter;
      margin: 1in 1.2in;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.65;
      color: #1a1a1a;
      padding: 48px 64px;
      max-width: 820px;
      margin: 0 auto;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Top accent */
    body::before {
      content: '';
      display: block;
      width: 60px;
      height: 3px;
      background: #2563eb;
      margin: 0 auto 32px auto;
    }

    .doc-title {
      font-family: 'Georgia', serif;
      font-size: 20pt;
      font-weight: 700;
      text-align: center;
      letter-spacing: 2px;
      color: #111;
      margin-bottom: 6px;
      padding-bottom: 16px;
      border-bottom: 1px solid #d4d4d8;
    }

    .exhibit-title {
      font-family: 'Georgia', serif;
      font-size: 16pt;
      font-weight: 700;
      text-align: center;
      letter-spacing: 1px;
      color: #111;
      margin-top: 8px;
      margin-bottom: 4px;
      padding-bottom: 12px;
      border-bottom: 1px solid #d4d4d8;
    }

    .exhibit-divider {
      border: none;
      border-top: 2px solid #2563eb;
      margin: 24px 0 16px 0;
      page-break-before: always;
    }

    .sub-title {
      font-size: 11pt;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: #222;
      margin-top: 20px;
      margin-bottom: 6px;
    }

    .section-label {
      font-size: 10pt;
      font-weight: 700;
      letter-spacing: 1px;
      color: #2563eb;
      margin-top: 18px;
      margin-bottom: 2px;
      text-transform: uppercase;
    }

    .numbered-section {
      font-size: 11pt;
      font-weight: 700;
      color: #111;
      margin-top: 20px;
      margin-bottom: 4px;
      padding-bottom: 3px;
      border-bottom: 1px solid #e4e4e7;
    }

    .numbered-section .section-num {
      color: #2563eb;
      margin-right: 4px;
      font-weight: 800;
    }

    .body-text {
      margin-top: 4px;
      margin-bottom: 4px;
      text-align: justify;
      hyphens: auto;
    }

    .field-line {
      margin-top: 2px;
      margin-bottom: 2px;
    }

    .field-label {
      font-weight: 600;
      color: #333;
    }

    .detail-item {
      margin-left: 24px;
      margin-top: 2px;
      margin-bottom: 2px;
    }

    .detail-label {
      font-weight: 600;
      color: #444;
    }

    .lettered-item {
      margin-left: 32px;
      margin-top: 3px;
      margin-bottom: 3px;
      text-indent: -16px;
      padding-left: 16px;
    }

    .signature-line {
      margin-top: 32px;
      margin-bottom: 6px;
      border-bottom: 1px solid #333;
      width: 280px;
    }

    .date-line {
      margin-top: 4px;
      margin-bottom: 24px;
      font-size: 10pt;
      color: #444;
    }

    .date-underline {
      display: inline-block;
      width: 160px;
      border-bottom: 1px solid #666;
      margin-left: 4px;
    }

    .spacer {
      height: 8px;
    }

    /* Footer with page numbers */
    @media print {
      body::before {
        position: fixed;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        margin: 0;
        margin-top: -24px;
      }

      @page {
        @bottom-center {
          content: counter(page);
          font-family: 'Georgia', serif;
          font-size: 9pt;
          color: #999;
        }
      }
    }

    /* Screen preview styling */
    @media screen {
      body {
        background: #fff;
        box-shadow: 0 0 40px rgba(0,0,0,0.08);
        border-radius: 2px;
        margin-top: 24px;
        margin-bottom: 24px;
      }
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
