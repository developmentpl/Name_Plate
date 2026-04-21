import JSZip from 'jszip';
import jsPDF from 'jspdf';

const MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const EXT = {
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpg',
  webp: 'webp',
  pdf: 'pdf',
};

/**
 * Export a single canvas as a file and trigger browser download.
 */
export async function exportSingle(canvas, format, filename = 'nameplate') {
  const fmt = format.toLowerCase();
  const ext = EXT[fmt] || 'png';

  if (fmt === 'pdf') {
    const blob = await canvasToPdfBlob(canvas);
    downloadBlob(blob, `${filename}.pdf`);
    return;
  }

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, MIME[fmt] || 'image/png', 0.92);
  });
  downloadBlob(blob, `${filename}.${ext}`);
}

/**
 * Export many canvases as a single ZIP file.
 * entries: Array<{ canvas, filename }>
 */
export async function exportBulkZip(entries, format, zipName = 'nameplates') {
  const fmt = format.toLowerCase();
  const ext = EXT[fmt] || 'png';
  const zip = new JSZip();

  for (const entry of entries) {
    const { canvas, filename } = entry;
    let blob;
    if (fmt === 'pdf') {
      blob = await canvasToPdfBlob(canvas);
    } else {
      blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, MIME[fmt] || 'image/png', 0.92);
      });
    }
    zip.file(`${filename}.${ext}`, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, `${zipName}.zip`);
}

async function canvasToPdfBlob(canvas) {
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  // Create a PDF sized to match the canvas, keeping 1:1 aspect
  const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [canvas.width, canvas.height],
    hotfixes: ['px_scaling'],
  });
  pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
  return pdf.output('blob');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function sanitizeFilename(s) {
  return String(s)
    .replace(/[^a-z0-9_\-]+/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60) || 'nameplate';
}
