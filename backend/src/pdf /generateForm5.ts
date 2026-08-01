import fs from "fs";
import { PDFDocument, StandardFonts } from "pdf-lib";

async function main() {
  const pdfBytes = fs.readFileSync("../../templates/form5.pdf");

  const pdfDoc = await PDFDocument.load(pdfBytes);

  const page = pdfDoc.getPage(0);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText("山田太郎", {
    x: 100,
    y: 700,
    size: 10,
    font
  });

  const bytes = await pdfDoc.save();

  fs.writeFileSync(
    "../../output/form5_test.pdf",
    bytes
  );
}

main();

