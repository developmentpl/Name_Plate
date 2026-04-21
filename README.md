# NamePlate Generator

A fully client-side React application for designing and bulk-generating nameplates.
No database, no backend, no server — everything runs in your browser.

## Features

- **Manual Mode** — design one nameplate with live preview, download as PNG / JPG / WEBP / PDF.
- **Bulk Mode** — upload an Excel or CSV file, generate up to 1000+ nameplates, edit any plate inline, download everything as a single ZIP.
- **Multilingual text** — English, Marathi (मराठी), Hindi (हिंदी), and mixed scripts.
- **Local fonts bundled** — Poppins (English), Kalam (English + Devanagari), Tiro Devanagari Marathi (optimized for Marathi). Also Noto Sans + Noto Sans Devanagari loaded from Google Fonts. Add more fonts anytime by dropping `.woff2` files into `public/fonts/` and editing `manifest.json`.
- **Flexible colors** — names (`red`), HEX (`#FF0000`), or CMYK in any format: `0,80,80,20`, `C0 M80 Y80 K20`, `cmyk(0,80,80,20)`.
- **Border styles** — none, single, dashed, or **double**. Double gives full independent control: outer color, outer thickness, gap, inner color, inner thickness.
- **Rounded corners** — set `corner_radius` for a softer look.
- **Font size presets** — Auto (fit-to-plate) or choose 12/16/20/24/32/48/64 pt.
- Size in **cm, mm, or inch**.
- 300 DPI export for print quality.

## Requirements

- **Node.js 18+** (you can check with `node --version`)
- That's it. No database, no Docker, no environment variables.

## Setup

Open a terminal in this folder and run:

```bash
npm install
npm run dev
```

The app opens automatically at **http://localhost:5173**.

## Production Build

```bash
npm run build
```

This creates a `dist/` folder containing a fully static site. You can:
- Host it for free on Netlify, Vercel, GitHub Pages.
- Or just open `dist/index.html` after serving it with any static web server.

## Project Structure

```
nameplate-app/
├── package.json               # dependencies & scripts
├── vite.config.js             # Vite build config
├── index.html                 # HTML entry point
├── public/
│   ├── favicon.svg
│   └── sample-template.xlsx   # downloadable Excel template
└── src/
    ├── main.jsx               # React mount
    ├── App.jsx                # tab switcher (Manual / Bulk)
    ├── styles/
    │   └── app.css            # all styling
    ├── components/
    │   ├── ManualMode.jsx     # form + live preview + single download
    │   ├── BulkMode.jsx       # upload, generate, preview grid, ZIP
    │   ├── ExportDialog.jsx   # format picker (PNG/JPG/WEBP/PDF)
    │   └── EditPlateModal.jsx # click-to-edit any plate
    └── utils/
        ├── unitConverter.js   # cm/mm/inch → pixels
        ├── colorResolver.js   # color name or HEX → valid hex
        ├── canvasRenderer.js  # core drawing with auto-fit text
        ├── excelParser.js     # SheetJS wrapper + row validation
        └── exporter.js        # single file, ZIP, PDF export
```

## Excel Template

The expected columns in your Excel/CSV are:

**Common columns (always used):**

| Column          | Required | Example                               |
|-----------------|----------|---------------------------------------|
| `sr_no`         | Yes      | `1`                                   |
| `text`          | Yes      | `Do Not Touch` or `थूकना सख्त मना है` |
| `text_color`    | Yes      | `red` or `#FF0000`                    |
| `bg_color`      | Yes      | `white` or `#FFFFFF`                  |
| `width`         | Yes      | `10`                                  |
| `height`        | Yes      | `5`                                   |
| `border_style`  | No       | `single` / `double` / `dashed` / `none` |
| `corner_radius` | No       | `0` (sharp) to `30` (rounded)         |
| `font_family`   | No       | `auto`, `Poppins`, `Kalam`, `Tiro Devanagari Marathi`, `Noto Sans`, `Noto Sans Devanagari` |
| `font_size`     | No       | `auto`, `12`, `16`, `20`, `24`, `32`, `48`, `64`      |

**For `single` or `dashed` border style:**

| Column             | Example     |
|--------------------|-------------|
| `border_color`     | `#000000`   |
| `border_thickness` | `4`         |

**For `double` border style** (5 independent controls — outer and inner can be different colors):

| Column             | Example     | Meaning                              |
|--------------------|-------------|--------------------------------------|
| `outer_color`      | `#1565C0`   | Color of the outer border line       |
| `outer_thickness`  | `14`        | Thickness of the outer line (px)     |
| `gap`              | `4`         | Space between outer and inner (px)   |
| `inner_color`      | `#FFFFFF`   | Color of the inner border line       |
| `inner_thickness`  | `3`         | Thickness of the inner line (px)     |

For multi-line text in a cell, press **Alt+Enter** inside Excel.

A sample file is included at `public/sample-template.xlsx` with ten examples covering every border style in English, Marathi, and Hindi.

## Adding your own fonts

The project ships with five fonts ready to use. To add more:

1. Download a `.woff2` (preferred) or `.ttf` file. Google Fonts is a great free source — most fonts there allow free commercial use.
2. Drop the file into `public/fonts/`.
3. Open `public/fonts/manifest.json` and add an entry:

```json
{
  "name": "Montserrat",
  "supports": ["english"],
  "variants": [
    { "weight": 400, "file": "Montserrat-Regular.woff2" },
    { "weight": 700, "file": "Montserrat-Bold.woff2" }
  ]
}
```

4. Refresh the app. The new font shows up in the Font Family dropdown automatically.

For fonts that support Marathi/Hindi, list `"devanagari"` in the `supports` array so the app knows it can use that font for Devanagari text.

## Tech Stack

- **React 18** + **Vite** — fast UI framework & dev server
- **HTML5 Canvas** — for all rendering
- **SheetJS** — Excel / CSV parsing
- **tinycolor2** — color name & HEX resolution
- **JSZip** — bulk ZIP packaging
- **jsPDF** — PDF export

## Performance

- Bulk generation processes 40 nameplates per batch with UI-yield pauses so the browser never freezes.
- Previews render at 96 DPI for speed; final exports render at 300 DPI for print quality.
- Tested comfortably up to 1000 plates per batch.

## License

Internal project — use freely within your organization.
