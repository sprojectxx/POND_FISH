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
// Common generic stop words that MUST NOT be used for single-keyword fish matching
const GENERIC_STOP_WORDS = new Set([
  'fish', 'fishes', 'sea', 'food', 'seafood', 'fresh', 'prime',
  'cut', 'cuts', 'large', 'small', 'medium', 'bone', 'less',
  'boneless', 'live', 'whole', 'dead', 'kg', 'kgs', 'kilo',
  'kilos', 'piece', 'pieces', 'qty', 'rs', 'inr', 'item', 'items'
]);

// Known regional synonyms / aliases mapping to catalog fish names
const FISH_SYNONYMS = {
  'catla': 'BOCHE',
  'bocche': 'BOCHE',
  'katla': 'BOCHE',
  'rohu': 'ROHU',
  'ruhi': 'ROHU',
  'mackerel': 'BANGDA',
  'pomfret': 'WHITE PALMPHLETE',
  'murrel': 'KORAMENU',
  'korameenu': 'KORAMENU',
  'anchovy': 'NETHILLI SEA FOOD',
  'anchovies': 'NETHILLI SEA FOOD',
  'prawn': 'PRAWNS MEDIUM',
  'prawns': 'PRAWNS MEDIUM',
};

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

  // 1. Detect grand total line
  for (const line of lines) {
    const totalMatch = line.match(/(?:TOTAL\s*AMOUNT|GRAND\s*TOTAL|NET\s*AMOUNT|AMOUNT\s*PAYABLE|TOTAL)[^\d]*([0-9]+(?:\.[0-9]{1,2})?)/i);
    if (totalMatch && totalMatch[1]) {
      const val = parseFloat(totalMatch[1]);
      if (!isNaN(val) && val > 0) {
        detectedGrandTotal = val;
      }
    }
  }

  // Build catalog lookup structures with non-generic tokens
  const catalogLookup = catalogFish.map((f) => {
    const rawTokens = f.name.toLowerCase().split(/[\s-]+/);
    const distinctiveTokens = rawTokens.filter((t) => t.length > 2 && !GENERIC_STOP_WORDS.has(t));
    return {
      fish: f,
      nameLower: f.name.toLowerCase().trim(),
      tokens: distinctiveTokens,
      descLower: (f.description || '').toLowerCase(),
    };
  });

  // 2. Scan lines for item entries
  for (const line of lines) {
    // Skip header lines or summary lines
    if (/^(?:BILL|DATE|TIME|ITEMS|TOTAL|PAID|THANK|PF)/i.test(line)) continue;
    if (/(?:TOTAL|GRAND TOTAL|NET AMOUNT|AMOUNT PAYABLE)/i.test(line)) continue;

    // Pattern: [Fish Name / Cut Description] [Quantity] [kg/kgs] [Rs./₹] [Subtotal / Price]
    const lineItemMatch = line.match(/^([A-Za-z\s]+?)\s+([0-9]+(?:\.[0-9]+)?)\s*(?:kg|kgs|kilo)?\s+(?:Rs\.?|₹|inr)?\s*[:=]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i);

    let candidateName = null;
    let quantityKg = null;
    let subtotal = null;

    if (lineItemMatch) {
      candidateName = lineItemMatch[1].trim();
      quantityKg = parseFloat(lineItemMatch[2]);
      subtotal = parseFloat(lineItemMatch[3]);
    } else {
      // Fallback extraction for irregular lines with fish keywords
      const qtyMatch = line.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:kg|kgs|kilo)/i);
      const priceMatches = Array.from(line.matchAll(/(?:₹|rs\.?|inr)?\s*([0-9]+(?:\.[0-9]{1,2})?)/gi))
        .map((m) => parseFloat(m[1]))
        .filter((n) => !isNaN(n) && n > 0);

      let foundFish = false;
      for (const entry of catalogLookup) {
        if (entry.tokens.some((t) => line.toLowerCase().includes(t))) {
          foundFish = true;
          break;
        }
      }
      for (const syn of Object.keys(FISH_SYNONYMS)) {
        if (line.toLowerCase().includes(syn)) {
          foundFish = true;
          break;
        }
      }

      if (foundFish && qtyMatch && priceMatches.length > 0) {
        quantityKg = parseFloat(qtyMatch[1]);
        subtotal = Math.max(...priceMatches);
        const namePart = line.slice(0, qtyMatch.index).trim();
        if (namePart.length > 2) candidateName = namePart;
      }
    }

    if (!candidateName || !quantityKg || !subtotal) continue;

    // Clean candidate fish name
    candidateName = candidateName.replace(/^(?:item\s*\d*|product|order|#)\s*[:.-]?\s*/i, '').trim();
    if (candidateName.length < 2) continue;

    // Implied unit price on receipt = subtotal / quantity
    const impliedUnitPrice = parseFloat((subtotal / quantityKg).toFixed(2));

    // Match candidate name to catalog without generic word false positives
    const nameLower = candidateName.toLowerCase();
    const candidateTokens = nameLower.split(/[\s-]+/).filter((t) => t.length > 2 && !GENERIC_STOP_WORDS.has(t));

    let matchedFish = null;
    let matchMethod = null;

    // A. Direct full name match
    for (const entry of catalogLookup) {
      if (entry.nameLower === nameLower || nameLower.includes(entry.nameLower)) {
        matchedFish = entry.fish;
        matchMethod = 'direct';
        break;
      }
    }

    // B. Token match on distinctive non-generic tokens (e.g. 'rohu')
    if (!matchedFish && candidateTokens.length > 0) {
      for (const entry of catalogLookup) {
        const hasDistinctiveMatch = candidateTokens.some((ct) => entry.tokens.includes(ct));
        if (hasDistinctiveMatch) {
          matchedFish = entry.fish;
          matchMethod = 'token';
          break;
        }
      }
    }

    // C. Synonym / Regional alias match (e.g. 'catla' -> 'BOCHE')
    if (!matchedFish && candidateTokens.length > 0) {
      for (const token of candidateTokens) {
        if (FISH_SYNONYMS[token]) {
          const targetName = FISH_SYNONYMS[token];
          const entry = catalogLookup.find((e) => e.fish.name.toUpperCase() === targetName);
          if (entry) {
            matchedFish = entry.fish;
            matchMethod = 'synonym';
            break;
          }
        }
      }
    }

    // D. Description match as fallback
    if (!matchedFish && candidateTokens.length > 0) {
      for (const entry of catalogLookup) {
        if (candidateTokens.some((ct) => entry.descLower.includes(ct))) {
          matchedFish = entry.fish;
          matchMethod = 'description';
          break;
        }
      }
    }

    const itemRecord = {
      fishId: matchedFish ? matchedFish.id : null,
      fishName: candidateName, // Preserves the fish name actually printed on receipt
      fishImageUrl: matchedFish ? (matchedFish.image_url || matchedFish.imageUrl || null) : null,
      quantityKg,              // Preserves quantity actually parsed from receipt
      unitPrice: impliedUnitPrice, // Preserves implied unit price from receipt
      subtotal,                // Preserves line subtotal from receipt
      confidence: matchedFish ? 0.95 : 0.70,
      catalogFishName: matchedFish ? matchedFish.name : null,
      catalogUnitPrice: matchedFish ? parseFloat(matchedFish.unit_price ?? matchedFish.unitPrice ?? 0) : null,
    };

    // Meaningful warnings generation per requirements:
    if (!matchedFish) {
      warnings.push(`Item '${candidateName}' could not be automatically matched to an authoritative catalog fish. Please verify or re-select.`);
    } else {
      const catalogPrice = itemRecord.catalogUnitPrice;
      if (catalogPrice > 0 && Math.abs(catalogPrice - impliedUnitPrice) > 1) {
        warnings.push(
          `Price discrepancy for '${candidateName}': receipt indicates ₹${impliedUnitPrice.toFixed(2)}/kg, but standard catalog price for ${matchedFish.name} is ₹${catalogPrice.toFixed(2)}/kg.`
        );
      }
      if (matchMethod === 'synonym' || matchMethod === 'description') {
        warnings.push(`'${candidateName}' was matched to catalog item '${matchedFish.name}' via regional synonym. Please verify cut selection.`);
      }
    }

    items.push(itemRecord);
  }

  // Fallback: If no items were parsed, report warning
  if (items.length === 0 && catalogFish.length > 0) {
    warnings.push('AI could not identify specific fish names from receipt text. Human review required.');
  }

  // Calculate sum of line items
  const lineItemsSum = items.reduce((acc, it) => acc + it.subtotal, 0);
  const finalTotal = detectedGrandTotal !== null ? detectedGrandTotal : lineItemsSum;

  if (detectedGrandTotal !== null && Math.abs(detectedGrandTotal - lineItemsSum) > 1) {
    warnings.push(`Receipt total amount (₹${detectedGrandTotal}) differs from sum of extracted items (₹${lineItemsSum.toFixed(2)}).`);
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
async function processBillImage({ customerId, imageInput, imageUrl = '/uploads/bills/sample-bill.jpg', dryRun = false }) {
  if (!customerId) {
    throw new Error('customerId is required for bill OCR processing.');
  }
  if (!imageInput) {
    throw new Error('imageInput (Buffer or base64 URI) is required for OCR processing.');
  }

  const startTime = Date.now();
  let rawText = '';
  let confidenceScore = 0;

  if (typeof imageInput === 'string' && !imageInput.startsWith('data:') && !imageInput.startsWith('http') && !imageInput.startsWith('/')) {
    rawText = cleanOcrText(imageInput);
    confidenceScore = 0.95;
  } else {
    try {
      // 1. Run Tesseract OCR worker
      const path = require('path');
      const workerPath = path.join(process.cwd(), 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js');
      const worker = await createWorker('eng', 1, { workerPath });
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

  // If development dry-run requested, bypass all database persistence paths
  if (dryRun) {
    const ephemeralScanId = `dryrun_${Date.now()}`;
    return {
      scanId: ephemeralScanId,
      billId: ephemeralScanId,
      billNumber: candidateBillNumber,
      billNumberMissing: !candidateBillNumber,
      confidenceScore,
      status,
      total,
      items,
      warnings,
      rawTextSnippet: rawText.slice(0, 200),
      createdAt: new Date().toISOString(),
      dryRun: true,
    };
  }

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
