const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

function splitChapters(content) {
  const lines = content.split("\n").map((l) => l.trim());
  const book = {
    title: "",
    author: "",
    coverImage: "",
    resume: "",
    chapters: [],
  };
  let current = "";
  let buffer = [];
  let chapterTitle = "";
  let currentImage = "";

  for (let line of lines) {
    if (line.startsWith("[TITRE]")) {
      book.title = line.replace("[TITRE] :", "").trim();
    } else if (line.startsWith("[AUTEUR]")) {
      book.author = line.replace("[AUTEUR] :", "").trim();
    } else if (line.startsWith("[Image couverture]")) {
      book.coverImage = line.replace("[Image couverture] :", "").trim();
    } else if (line.startsWith("[Résumé]")) {
      if (current === "chapter" && buffer.length > 0) {
        book.chapters.push({
          title: chapterTitle,
          image: currentImage,
          text: buffer.join("\n").trim(),
        });
      }
      current = "resume";
      buffer = [];
    } else if (line.startsWith("[Chapitre")) {
      if (current === "chapter" && buffer.length > 0) {
        book.chapters.push({
          title: chapterTitle,
          image: currentImage,
          text: buffer.join("\n").trim(),
        });
        buffer = [];
        currentImage = "";
      }
      current = "chapter";
      chapterTitle = line.replace(/\[|\]/g, "").trim();
    } else if (line.startsWith("Image :")) {
      currentImage = line.replace("Image :", "").trim();
    } else {
      buffer.push(line);
    }
  }

  if (current === "chapter" && buffer.length > 0) {
    book.chapters.push({
      title: chapterTitle,
      image: currentImage,
      text: buffer.join("\n").trim(),
    });
  } 
  if (current === "resume" && buffer.length > 0) {
    book.resume = buffer.join("\n").trim();
  }

  return book;
}

async function generatePDF(content) {
  const book = splitChapters(content);
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  const drawTextPaginated = (title, body) => {
    const fontSize = 14;
    const lineHeight = 20;
    const margin = 50;
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const maxWidth = pageWidth - margin * 2;
    const maxLinesPerPage = Math.floor((pageHeight - margin * 2 - 40) / lineHeight);

    const text = body.replace(/\u2009/g, " ");
    const paragraphs = text.split("\n");
    const lines = [];

    for (const paragraph of paragraphs) {
      const words = paragraph.split(" ");
      let line = "";

      for (const word of words) {
        const testLine = line.length > 0 ? line + " " + word : word;
        const width = font.widthOfTextAtSize(testLine, fontSize);
        if (width < maxWidth) {
          line = testLine;
        } else {
          lines.push(line);
          line = word;
        }
      }
      if (line.length > 0) lines.push(line);
      lines.push("");
    }

    let currentLine = 0;
    while (currentLine < lines.length) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;

      if (currentLine === 0 && title) {
        page.drawText(title, {
          x: margin,
          y,
          size: 20,
          font,
          color: rgb(0, 0, 0),
        });
        y -= lineHeight + 10;
      }

      for (let i = 0; i < maxLinesPerPage && currentLine < lines.length; i++) {
        const line = lines[currentLine];
        page.drawText(line, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
        y -= lineHeight;
        currentLine++;
      }
    }
  };

  drawTextPaginated(book.title, `${book.coverImage ? `Illustration de couverture : ${book.coverImage}\n\n` : ""}Un livre de ${book.author}`);

  for (const chapter of book.chapters) {
    const fullText = `${chapter.image ? "Image suggérée : " + chapter.image + "\n\n" : ""}${chapter.text}`;
    drawTextPaginated(chapter.title, fullText);
  }

  if (book.resume) {
    drawTextPaginated("Résumé", book.resume);
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

module.exports = generatePDF;
