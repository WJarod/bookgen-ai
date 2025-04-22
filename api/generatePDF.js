const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

async function generatePDF(content) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 50;
  const fontSizeTitle = 20;
  const fontSizeText = 14;
  const lineHeight = 20;
  const maxWidth = pageWidth - margin * 2;

  const lines = content.split("\n").map(line => line.trim());

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawText = (text, size = fontSizeText) => {
    const paragraphs = text.split("\n");
    for (const paragraph of paragraphs) {
      const words = paragraph.split(" ");
      let line = "";

      for (const word of words) {
        const testLine = line.length > 0 ? line + " " + word : word;
        const width = font.widthOfTextAtSize(testLine, size);
        if (width < maxWidth) {
          line = testLine;
        } else {
          if (y < margin + lineHeight) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            y = pageHeight - margin;
          }
          currentPage.drawText(line, { x: margin, y, size, font, color: rgb(0, 0, 0) });
          y -= lineHeight;
          line = word;
        }
      }

      if (line) {
        if (y < margin + lineHeight) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        currentPage.drawText(line, { x: margin, y, size, font, color: rgb(0, 0, 0) });
        y -= lineHeight;
      }

      y -= lineHeight / 2;
    }
  };

  let buffer = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("[Chapitre") || line.startsWith("[Résumé]")) {
      if (buffer.length > 0) {
        drawText(buffer.join("\n"));
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
        buffer = [];
      }
    }
    buffer.push(line);
  }

  if (buffer.length > 0) {
    drawText(buffer.join("\n"));
  }

  return await pdfDoc.save();
}

module.exports = generatePDF;
