import { PDFDocument } from "pdf-lib";

export async function createPhotoPdf(jpeg, name) {
  const pdf = await PDFDocument.create();
  const photo = await pdf.embedJpg(jpeg);
  const portrait = photo.height >= photo.width;
  const page = pdf.addPage(portrait ? [595, 842] : [842, 595]);
  const { width, height } = photo.scaleToFit(page.getWidth() - 48, page.getHeight() - 48);
  page.drawImage(photo, {
    width,
    height,
    x: (page.getWidth() - width) / 2,
    y: (page.getHeight() - height) / 2
  });
  return new File([await pdf.save()], name.replace(/\.[^.]+$/, "") + ".pdf", { type: "application/pdf" });
}

export async function capturePhotoDocument(file) {
  if (file.size > 24 * 1024 * 1024) throw new Error("Zdjęcie może mieć maksymalnie 24 MB.");
  const url = URL.createObjectURL(file);
  let jpeg;
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const ratio = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Nie udało się przygotować zdjęcia.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    jpeg = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
  if (!jpeg) throw new Error("Nie udało się zapisać zdjęcia.");
  return createPhotoPdf(await jpeg.arrayBuffer(), file.name || "zdjecie");
}
