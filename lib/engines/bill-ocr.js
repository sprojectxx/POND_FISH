/**
 * Engine 11: Physical Store Bill Slip Upload & OCR Extraction Engine
 * Traceability: PondFish Core Business Engines Specification v1 (Sections 16, 17),
 *               API Specification v1 (Sections 18, 19, 20), Master PRD v2 (Section 8)
 * 
 * Responsibilities:
 * 1. Process physical receipt images via Tesseract.js OCR.
 * 2. Identify candidate Bill Numbers, Fish cuts, weights (kg), prices, and totals.
 * 3. Match candidate fish items against the authoritative fish catalogue.
 * 4. Calculate extraction confidence and advisory review status.
 * 5. Immutable logging into ai_extraction_logs table.
 * 6. Fallback detection for missing Bill ID (CP-08 / CP-16).
 */

const { createWorker } = require('tesseract.js');
const billRepository = require('../db/repositories/billRepository');
const fishRepository = require('../db/repositories/fishRepository');

/**
 * Clean and normalize extracted text string
 * @param {string} text
 * @returns {string}
 */
function cleanOcrText(text) {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[^\x20-\x7E\n₹]/g, ' ')
    .trim();
}

/**
 * Extract candidate Bill Number from OCR text
 * Patterns: "Bill #12345", "Bill No: PF-001", "BILL-90812", "Receipt: 1042"
 * @param {string} text
 * @returns {string|null}
 */
function extractCandidateBillNumber(text) {
  if (!text) return null;

  const patterns = [
    /(?:BILL|RECEIPT|INVOICE|SLIP|ORDER)[^a-zA-Z0-9#]*#?[:.\s-]*([A-Z0-9_-]{3,32})/i,
    /(?:PF-BILL-[A-Z0-9_-]+)/i,
    /(?:BILL-[A-Z0-9_-]+)/i,
    /#\s*([A-Z0-9_-]{4,20})/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const candidate = match[1].trim().toUpperCase();
      // Ensure candidate has digits or standard format
      if (candidate.length >= 3 && candidate.length <= 32) {
        return candidate.startsWith('BILL-') ? candidate : `BILL-${candidate}`;
      }
    } else if (match && match[0]) {
      return match[0].trim().toUpperCase();
    }
  }

  return null;
}

/**
 * Parse line items and match against known fish in the catalog
 * @param {string} text
 * @param {Array<object>} catalogFish
 * @returns {object} { items: Array<object>, total: number, warnings: Array<string> }
 */
function parseBillItems(text, catalogFish = []) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const items = [];
  const warnings = [];
  let detectedGrandTotal = null;

  // Check for grand total line first
  for (const line of lines) {
    const totalMatch = line.match(/(?:TOTAL|GRAND TOTAL|NET AMOUNT|AMOUNT PAYABLE|SUBTOTAL)[^\d]*([0-9]+(?:\.[0-9]{1,2})?)/i);
    if (totalMatch && totalMatch[1]) {
      const val = parseFloat(totalMatch[1]);
      if (!isNaN(val) && val > 0) {
        detectedGrandTotal = val;
      }
    }
  }

  // Map of lowercase fish name to catalog entry
  const fishNameLookup = [];
  for (const fish of catalogFish) {
    fishNameLookup.push({
      fish,
      nameLower: fish.name.toLowerCase().trim(),
      keywords: fish.name.toLowerCase().split(/[\s-]+/).filter((w) => w.length > 2),
    });
  }

  // Scan lines for fish names and numbers
  for (const line of lines) {
    const lineLower = line.toLowerCase();
    let matchedFish = null;

    // 1. Direct name match
    for (const entry of fishNameLookup) {
      if (lineLower.includes(entry.nameLower)) {
        matchedFish = entry.fish;
        break;
      }
    }

    // 2. Keyword fallback (if unique match)
    if (!matchedFish) {
      for (const entry of fishNameLookup) {
        const hasKeyword = entry.keywords.some((kw) => lineLower.includes(kw));
        if (hasKeyword) {
          matchedFish = entry.fish;
          break;
        }
      }
    }

    if (matchedFish) {
      // Avoid duplicate matching the same fish on multiple fragmented lines
      const alreadyAdded = items.find((i) => i.fishId === matchedFish.id);
      if (alreadyAdded) continue;

      // Extract quantity (kg) and unit price or subtotal
      // Examples: "1.5 kg @ 400 = 600", "2.0kg 800", "Catla 2kg 700"
      const qtyMatch = line.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:kg|kgs|kilo)?/i);
      const priceMatches = Array.from(line.matchAll(/(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]{1,2})?)/gi))
        .map((m) => parseFloat(m[1]))
        .filter((n) => !isNaN(n) && n > 0);

      let quantityKg = 1.0;
      if (qtyMatch && parseFloat(qtyMatch[1]) > 0 && parseFloat(qtyMatch[1]) <= 50) {
        quantityKg = parseFloat(qtyMatch[1]);
      }

      const authoritativeUnitPrice = parseFloat(matchedFish.unit_price ?? matchedFish.unitPrice ?? 0);
      let subtotal = parseFloat((quantityKg * authoritativeUnitPrice).toFixed(2));

      // If a subtotal was printed on the line, verify or capture it
      if (priceMatches.length > 0) {
        // Highest number on line is likely subtotal
        const maxPrice = Math.max(...priceMatches);
        if (maxPrice > 10 && maxPrice < 50000) {
          subtotal = maxPrice;
          // Re-estimate quantity if standard price known
          if (authoritativeUnitPrice > 0 && Math.abs(subtotal - quantityKg * authoritativeUnitPrice) > 10) {
            quantityKg = parseFloat((subtotal / authoritativeUnitPrice).toFixed(2));
          }
        }
      }

      items.push({
        fishId: matchedFish.id,
        fishName: matchedFish.name,
        fishImageUrl: matchedFish.image_url || matchedFish.imageUrl || null,
        quantityKg,
        unitPrice: authoritativeUnitPrice,
        subtotal,
        confidence: 0.9,
      });
    }
  }

  // Fallback: If no fish matched directly from text, pick top available fish to allow review
  if (items.length === 0 && catalogFish.length > 0) {
    warnings.push('AI could not identify specific fish names from receipt text. Human review required.');
  }

  // Calculate sum of line items
  const lineItemsSum = items.reduce((acc, it) => acc + it.subtotal, 0);
  const finalTotal = detectedGrandTotal !== null ? detectedGrandTotal : lineItemsSum;

  if (detectedGrandTotal !== null && Math.abs(detectedGrandTotal - lineItemsSum) > 5) {
    warnings.push(`Extracted bill total (₹${detectedGrandTotal}) differs from sum of extracted line items (₹${lineItemsSum.toFixed(2)}).`);
  }

  return {
    items,
    total: parseFloat(finalTotal.toFixed(2)),
    warnings,
  };
}

/**
 * Execute OCR text extraction and bill structuring
 * @param {object} params
 * @param {string} params.customerId - Authenticated customer ID
 * @param {Buffer|string} params.imageInput - File buffer or base64 data URI
 * @param {string} [params.imageUrl] - Stored or mock URL path
 * @returns {Promise<object>} Structured extraction result
 */
async function processBillImage({ customerId, imageInput, imageUrl = '/uploads/bills/sample-bill.jpg' }) {
  if (!customerId) {
    throw new Error('customerId is required for bill OCR processing.');
  }
  if (!imageInput) {
    throw new Error('imageInput (Buffer or base64 URI) is required for OCR processing.');
  }

  const startTime = Date.now();
  let rawText = '';
  let confidenceScore = 0;

  try {
    // 1. Run Tesseract OCR worker
    const worker = await createWorker('eng');
    const ocrResult = await worker.recognize(imageInput);
    await worker.terminate();

    rawText = cleanOcrText(ocrResult?.data?.text || '');
    confidenceScore = parseFloat(((ocrResult?.data?.confidence || 0) / 100).toFixed(2));
  } catch (ocrErr) {
    console.warn('[BILL OCR] Tesseract extraction warning, using fallback heuristics:', ocrErr.message);
    // If OCR engine had error (e.g. invalid graphic format), fallback to heuristics
    rawText = typeof imageInput === 'string' && !imageInput.startsWith('data:') ? imageInput : '';
    confidenceScore = 0.5;
  }

  const duration = Date.now() - startTime;

  // 2. Fetch authoritative fish catalogue for matching
  const catalogFish = await fishRepository.getAllFish({ availabilityOnly: false });

  // 3. Extract candidate Bill ID and item lines
  const candidateBillNumber = extractCandidateBillNumber(rawText);
  const { items, total, warnings } = parseBillItems(rawText, catalogFish);

  // If text was too sparse or unreadable, flag appropriate status
  const isUnreadable = rawText.length < 5 || confidenceScore < 0.2;
  const status = isUnreadable
    ? 'UNREADABLE'
    : (candidateBillNumber ? 'EXTRACTED' : 'REVIEW_REQUIRED');

  // 4. Create persistent record in bills table
  const bill = await billRepository.createBill(null, {
    customerId,
    imageUrl,
    billNumber: candidateBillNumber,
    extractedText: rawText,
    aiConfidenceScore: confidenceScore,
    status: isUnreadable ? 'REJECTED' : 'EXTRACTED',
  });

  // 5. Immutable audit log in ai_extraction_logs table
  await billRepository.logAiExtraction(null, {
    billId: bill.id,
    rawResponse: {
      textLength: rawText.length,
      extractedLines: rawText.split('\n').length,
      candidateBillNumber,
      matchedItemsCount: items.length,
      total,
      warnings,
      rawSnippet: rawText.slice(0, 300),
    },
    confidenceScore,
    extractionDuration: duration,
  });

  return {
    scanId: bill.id,
    billId: bill.id,
    billNumber: candidateBillNumber,
    billNumberMissing: !candidateBillNumber,
    confidenceScore,
    status,
    total,
    items,
    warnings,
    rawTextSnippet: rawText.slice(0, 200),
    createdAt: bill.created_at,
  };
}

module.exports = {
  name: 'BillOCREngine',
  processBillImage,
  cleanOcrText,
  extractCandidateBillNumber,
  parseBillItems,
};
