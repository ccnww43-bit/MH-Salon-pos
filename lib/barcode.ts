import JsBarcode from "jsbarcode";
import { db } from "./db";

/**
 * Generates a random 12-digit internal barcode.
 *
 * Prefixed with "20", which is the range real-world UPC/EAN systems
 * reserve for in-store / internal use (never issued to an actual
 * manufacturer), so a generated code can never collide with a
 * genuine product barcode a supplier printed on their packaging.
 */
export function generateBarcodeValue(): string {
  let digits = "";
  for (let i = 0; i < 10; i++) {
    digits += Math.floor(Math.random() * 10).toString();
  }
  return `20${digits}`;
}

/**
 * Generates barcode values until one that isn't already used by
 * another product is found, and returns it. `barcode` isn't an
 * indexed field on db.inventory, so this scans with .filter() —
 * perfectly fine at salon-inventory scale, and avoided on every
 * keystroke by only calling this on "Generate" click / on save.
 */
export async function getUniqueBarcode(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = generateBarcodeValue();
    const clash = await db.inventory
      .filter((i) => i.barcode === candidate)
      .count();
    if (!clash) return candidate;
  }
  // Astronomically unlikely to ever be reached (10^10 possibilities),
  // but fall back to a time-based value rather than looping forever.
  return `20${Date.now().toString().slice(-10)}`;
}

/**
 * Renders `value` as a CODE128 barcode and returns it as standalone
 * SVG markup (a string, not a mounted element) so callers can drop it
 * straight into a print window's document.
 *
 * Briefly attaches the SVG off-screen before handing it to JsBarcode —
 * some browsers need it in the DOM to measure the human-readable text
 * under the bars — then detaches it again.
 */
export function renderBarcodeSvgMarkup(value: string): string {
  const svg = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg"
  );
  svg.style.position = "fixed";
  svg.style.left = "-9999px";
  svg.style.top = "-9999px";
  document.body.appendChild(svg);

  try {
    JsBarcode(svg, value, {
      format: "CODE128",
      displayValue: true,
      fontSize: 14,
      height: 40,
      margin: 0,
    });
    return svg.outerHTML;
  } finally {
    document.body.removeChild(svg);
  }
}

interface BarcodeLabelInput {
  name: string;
  barcode: string;
  price?: number;
  currency?: string;
}

/**
 * Opens a small popup window sized for a thermal label printer (a
 * 40mm x 25mm strip — the common size for barcode stickers) and
 * prints the product's barcode label.
 *
 * If the printer driver in the person's print dialog uses a
 * different label size, the @page rule below is the one line to
 * change.
 */
export function printBarcodeLabel({
  name,
  barcode,
  price,
  currency = "KSh",
}: BarcodeLabelInput) {
  const printWindow = window.open("", "_blank", "width=420,height=320");

  if (!printWindow) {
    alert(
      "Couldn't open the print window — please allow pop-ups for this site and try again."
    );
    return;
  }

  const barcodeSvg = renderBarcodeSvgMarkup(barcode);

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  printWindow.document.write(`
<!DOCTYPE html>
<html>
  <head>
    <title>Barcode Label</title>
    <style>
      @page { size: 40mm 25mm; margin: 0; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        width: 40mm;
        height: 25mm;
      }
      .label {
        width: 40mm;
        height: 25mm;
        padding: 1mm;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-family: Arial, Helvetica, sans-serif;
        overflow: hidden;
      }
      .label .name {
        font-size: 7px;
        font-weight: 700;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 38mm;
        line-height: 1.2;
      }
      .label svg {
        width: 36mm;
        height: auto;
      }
      .label .price {
        font-size: 9px;
        font-weight: 800;
        margin-top: 0.5mm;
      }
    </style>
  </head>
  <body onload="window.print(); setTimeout(function(){ window.close(); }, 200);">
    <div class="label">
      <div class="name">${escapeHtml(name)}</div>
      ${barcodeSvg}
      ${
        price !== undefined
          ? `<div class="price">${escapeHtml(currency)} ${price.toLocaleString()}</div>`
          : ""
      }
    </div>
  </body>
</html>
  `);

  printWindow.document.close();
}
