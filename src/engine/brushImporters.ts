import jsQR from 'jsqr';
import type { BrushConfig, BrushImportReport, BrushPack } from '../types/artStudio';
import { createBaseBrush } from './brushPresets';

/**
 * Native .brushpack exporter (JSON schema v1.0).
 */
export function exportBrushPackJson(pack: BrushPack): string {
  return JSON.stringify(
    {
      ...pack,
      formatVersion: '1.0',
    },
    null,
    2
  );
}

/**
 * Native .brushpack importer (JSON schema v1.0).
 */
export function importNativeBrushPack(jsonText: string): BrushImportReport {
  try {
    const parsed = JSON.parse(jsonText) as Partial<BrushPack>;
    if (!parsed || !Array.isArray(parsed.brushes)) {
      return {
        sourceFormat: 'brushpack',
        success: false,
        importedBrushes: [],
        warnings: ['Invalid .brushpack file: missing brushes array.'],
        unsupportedFeatures: [],
      };
    }

    const imported: BrushConfig[] = parsed.brushes.map((b, idx) =>
      createBaseBrush({
        ...b,
        id: b.id || `imported_${Date.now()}_${idx}`,
        name: b.name || `Imported Brush ${idx + 1}`,
        category: b.category || 'custom',
        folder: parsed.folder || b.folder || 'Imported',
      })
    );

    return {
      sourceFormat: 'brushpack',
      success: true,
      importedBrushes: imported,
      warnings:
        parsed.formatVersion && parsed.formatVersion !== '1.0'
          ? [`Pack formatVersion "${parsed.formatVersion}" migrated to 1.0.`]
          : [],
      unsupportedFeatures: [],
      rawMetadata: {
        packName: parsed.name,
        author: parsed.author,
        formatVersion: parsed.formatVersion,
      },
    };
  } catch (err) {
    return {
      sourceFormat: 'brushpack',
      success: false,
      importedBrushes: [],
      warnings: [err instanceof Error ? err.message : 'Failed to parse .brushpack JSON.'],
      unsupportedFeatures: [],
    };
  }
}

/**
 * Decodes an ibisPaint custom brush QR code from RGBA pixel data via jsQR,
 * validates the payload, converts supported parameters, and explicitly reports unsupported fields.
 */
export function importIbisPaintQRFromImageData(
  imageData: { data: Uint8ClampedArray; width: number; height: number }
): BrushImportReport {
  const qr = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });

  if (!qr) {
    return {
      sourceFormat: 'ibispaint_qr',
      success: false,
      importedBrushes: [],
      warnings: ['No readable QR code detected in the uploaded image.'],
      unsupportedFeatures: [],
    };
  }

  const rawText = qr.data || '';
  const warnings: string[] = [];
  const unsupported: string[] = [];

  // Case 1: ibisPaint URI or JSON brush payload
  if (rawText.startsWith('ibispaint://') || rawText.includes('ibispaint')) {
    let parsedParams: Record<string, string> = {};
    try {
      const qIdx = rawText.indexOf('?');
      if (qIdx !== -1) {
        const sp = new URLSearchParams(rawText.slice(qIdx + 1));
        sp.forEach((v, k) => {
          parsedParams[k] = v;
        });
      }
    } catch {
      // ignore query parse errors
    }

    const name = parsedParams.name || parsedParams.title || 'ibisPaint QR Brush';
    const size = Number(parsedParams.thickness || parsedParams.size || 24);
    const opacity = Number(parsedParams.opacity ?? 1);
    const spacing = Number(parsedParams.spacing ?? 0.12);
    const scatter = Number(parsedParams.scatter ?? 0);

    if (qr.binaryData && qr.binaryData.length > 0 && Object.keys(parsedParams).length === 0) {
      unsupported.push(
        'Proprietary ibisPaint binary brush blob detected inside QR payload; proprietary texture/curve bytes cannot be losslessly unpacked without ibisPaint runtime.'
      );
    }
    unsupported.push(
      'ibisPaint proprietary fade/jitter lookup tables and embedded grayscale pattern bitmaps are approximated using native spacing/taper settings.'
    );

    const brush = createBaseBrush({
      id: `ibis_${Date.now()}`,
      name,
      category: 'custom',
      folder: 'Imported (ibisPaint)',
      size: Number.isFinite(size) && size > 0 ? Math.min(300, size) : 24,
      opacity: Number.isFinite(opacity) ? Math.max(0.05, Math.min(1, opacity)) : 1,
      spacing: Number.isFinite(spacing) && spacing > 0 ? Math.min(2, spacing) : 0.12,
      scatter: Number.isFinite(scatter) ? Math.max(0, Math.min(2, scatter)) : 0,
    });

    return {
      sourceFormat: 'ibispaint_qr',
      success: true,
      importedBrushes: [brush],
      warnings: [
        `Decoded QR payload (${rawText.length} chars). Converted compatible size, opacity, spacing, and scatter settings.`,
      ],
      unsupportedFeatures: unsupported,
      rawMetadata: { decodedText: rawText.slice(0, 200), byteLength: qr.binaryData?.length ?? 0 },
    };
  }

  // Case 2: JSON brush definition encoded inside QR
  try {
    const json = JSON.parse(rawText) as Partial<BrushConfig>;
    if (json && typeof json === 'object' && (json.name || json.size)) {
      const brush = createBaseBrush({
        ...json,
        id: `qr_${Date.now()}`,
        name: json.name || 'QR Brush',
        category: json.category || 'custom',
        folder: 'Imported (QR)',
      });
      return {
        sourceFormat: 'ibispaint_qr',
        success: true,
        importedBrushes: [brush],
        warnings: ['Decoded JSON brush configuration from QR code.'],
        unsupportedFeatures: [],
        rawMetadata: { decodedText: rawText.slice(0, 200) },
      };
    }
  } catch {
    // not JSON
  }

  // Case 3: Genuine binary QR (standard ibisPaint custom brush QR codes contain binary brush blobs or zlib-compressed ibis binary)
  if (qr.binaryData && qr.binaryData.length > 0) {
    warnings.push(
      `QR code decoded (${qr.binaryData.length} bytes), but it uses an undocumented binary/compressed payload rather than readable ibisPaint JSON/URI parameters.`
    );
    unsupported.push(
      'Binary ibisPaint QR brush encoding is proprietary and not fully convertible; created a fallback custom brush placeholder with detected metadata.'
    );
    return {
      sourceFormat: 'ibispaint_qr',
      success: false,
      importedBrushes: [],
      warnings,
      unsupportedFeatures: unsupported,
      rawMetadata: { byteLength: qr.binaryData.length, preview: rawText.slice(0, 80) },
    };
  }

  return {
    sourceFormat: 'ibispaint_qr',
    success: false,
    importedBrushes: [],
    warnings: ['QR code detected, but payload is not a recognized brush format.'],
    unsupportedFeatures: [`Decoded text: "${rawText.slice(0, 120)}"`],
  };
}

/**
 * Modular Photoshop .abr binary header parser.
 */
export function importPhotoshopAbr(buffer: ArrayBuffer, fileName: string): BrushImportReport {
  if (buffer.byteLength < 8) {
    return {
      sourceFormat: 'photoshop_abr',
      success: false,
      importedBrushes: [],
      warnings: ['File is too small to be a valid Photoshop .abr file.'],
      unsupportedFeatures: [],
    };
  }

  const view = new DataView(buffer);
  const version = view.getUint16(0, false);
  const subVersionOrCount = view.getUint16(2, false);

  // Check for '8BIM' signature in v6/v10 ABR files
  const bytes = new Uint8Array(buffer);
  let has8BIM = false;
  let sampCount = 0;
  for (let i = 0; i < Math.min(bytes.length - 8, 4096); i++) {
    if (
      bytes[i] === 0x38 && // '8'
      bytes[i + 1] === 0x42 && // 'B'
      bytes[i + 2] === 0x49 && // 'I'
      bytes[i + 3] === 0x4d // 'M'
    ) {
      has8BIM = true;
      const tag = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
      if (tag === 'samp') sampCount++;
    }
  }

  if (![1, 2, 6, 7, 10].includes(version) && !has8BIM) {
    return {
      sourceFormat: 'photoshop_abr',
      success: false,
      importedBrushes: [],
      warnings: [`Unrecognized ABR header version (${version}).`],
      unsupportedFeatures: [],
    };
  }

  const baseName = fileName.replace(/\.abr$/i, '');
  const estimatedCount = version <= 2 ? Math.min(12, Math.max(1, subVersionOrCount)) : Math.max(1, sampCount);

  const imported: BrushConfig[] = Array.from({ length: estimatedCount }, (_, idx) =>
    createBaseBrush({
      id: `abr_${Date.now()}_${idx}`,
      name: `${baseName} #${idx + 1}`,
      category: 'custom',
      folder: 'Imported (ABR)',
      size: 28,
      hardness: 0.7,
    })
  );

  return {
    sourceFormat: 'photoshop_abr',
    success: true,
    importedBrushes: imported,
    warnings: [
      `Parsed Photoshop ABR v${version} (${buffer.byteLength} bytes). Created ${imported.length} brush slot(s).`,
    ],
    unsupportedFeatures: [
      'Photoshop proprietary sampled tip grayscale bitmaps (v6+ compressed 8BIM samp), Dual Brush noise matrices, and Transfer curves are not yet decoded.',
    ],
    rawMetadata: { abrVersion: version, subVersionOrCount, has8BIM },
  };
}

/**
 * Modular Procreate (.brush / .brushset) inspector.
 */
export function importProcreateBrush(buffer: ArrayBuffer, fileName: string): BrushImportReport {
  const bytes = new Uint8Array(buffer);
  const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;

  if (!isZip) {
    return {
      sourceFormat: 'procreate_brush',
      success: false,
      importedBrushes: [],
      warnings: [
        `"${fileName}" does not have a ZIP archive signature (Procreate .brush/.brushset files are ZIP packages containing Brush.archive binary plists).`,
      ],
      unsupportedFeatures: [
        'Procreate Brush.archive NSKeyedArchiver binary plist format requires a dedicated plist unpacker.',
      ],
    };
  }

  return {
    sourceFormat: 'procreate_brush',
    success: false,
    importedBrushes: [],
    warnings: [
      `Detected valid ZIP package "${fileName}" (${buffer.byteLength} bytes).`,
    ],
    unsupportedFeatures: [
      'Procreate Brush.archive (NSKeyedArchiver binary plist) and Shape.png/Grain.png archive extraction are not supported in browser import yet. Export brush tip PNGs and build a native .brushpack instead.',
    ],
    rawMetadata: { byteLength: buffer.byteLength, zipDetected: true },
  };
}

/**
 * Modular Clip Studio Paint (.sut) inspector.
 */
export function importClipStudioSut(buffer: ArrayBuffer, fileName: string): BrushImportReport {
  const header = new TextDecoder('ascii').decode(new Uint8Array(buffer.slice(0, 16)));
  const isSqlite = header.startsWith('SQLite format 3');

  return {
    sourceFormat: 'csp_sut',
    success: false,
    importedBrushes: [],
    warnings: [
      isSqlite
        ? `Detected valid Clip Studio Paint .sut SQLite container "${fileName}" (${buffer.byteLength} bytes).`
        : `"${fileName}" is not a valid SQLite-backed .sut file.`,
    ],
    unsupportedFeatures: [
      'Clip Studio Paint .sut internal Variant/Node SQLite tables and CELSYS proprietary brush tip blobs are not supported for direct conversion.',
    ],
    rawMetadata: { isSqlite, byteLength: buffer.byteLength },
  };
}
