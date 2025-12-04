/**
 * Extract collateral information from text input
 * Parses common patterns like "Vehicle: Toyota Corolla 2015, Value: 50000"
 */

export interface ExtractedCollateral {
  type: 'vehicle' | 'land' | 'property' | 'equipment' | 'electronics' | 'jewelry' | 'livestock' | 'other';
  description: string;
  estimatedValue?: number;
  brand?: string;
  model?: string;
  year?: number;
  serialNumber?: string;
  condition?: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Extract collateral information from a text description
 */
export function extractCollateralFromText(text: string): ExtractedCollateral[] {
  if (!text || !text.trim()) return [];

  const collaterals: ExtractedCollateral[] = [];
  const lines = text.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    // Detect type
    let type: ExtractedCollateral['type'] = 'other';
    if (lowerLine.includes('vehicle') || lowerLine.includes('car') || lowerLine.includes('truck') || lowerLine.includes('motorcycle')) {
      type = 'vehicle';
    } else if (lowerLine.includes('land') || lowerLine.includes('plot') || lowerLine.includes('property')) {
      type = 'land';
    } else if (lowerLine.includes('house') || lowerLine.includes('building') || lowerLine.includes('property')) {
      type = 'property';
    } else if (lowerLine.includes('equipment') || lowerLine.includes('machinery')) {
      type = 'equipment';
    } else if (lowerLine.includes('phone') || lowerLine.includes('laptop') || lowerLine.includes('computer') || lowerLine.includes('tv')) {
      type = 'electronics';
    } else if (lowerLine.includes('jewelry') || lowerLine.includes('gold') || lowerLine.includes('silver')) {
      type = 'jewelry';
    } else if (lowerLine.includes('cattle') || lowerLine.includes('livestock') || lowerLine.includes('goat') || lowerLine.includes('cow')) {
      type = 'livestock';
    }

    // Extract value
    const valueMatch = line.match(/(?:value|worth|price|cost|amount)[:\s]+(?:zmw|kwacha|k|z)?\s*([\d,]+\.?\d*)/i);
    const estimatedValue = valueMatch ? parseFloat(valueMatch[1].replace(/,/g, '')) : undefined;

    // Extract year
    const yearMatch = line.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? parseInt(yearMatch[0]) : undefined;

    // Extract brand/model (common patterns)
    const brandModelMatch = line.match(/(toyota|honda|nissan|ford|mercedes|bmw|samsung|apple|lg|sony|hp|dell)\s+([a-z0-9\s]+)/i);
    const brand = brandModelMatch ? brandModelMatch[1] : undefined;
    const model = brandModelMatch ? brandModelMatch[2].trim() : undefined;

    // Extract serial number
    const serialMatch = line.match(/(?:serial|s\/n|sn)[:\s]+([a-z0-9\-]+)/i);
    const serialNumber = serialMatch ? serialMatch[1] : undefined;

    // Extract condition
    let condition: ExtractedCollateral['condition'] | undefined;
    if (lowerLine.includes('excellent') || lowerLine.includes('new') || lowerLine.includes('mint')) {
      condition = 'excellent';
    } else if (lowerLine.includes('good') || lowerLine.includes('fair condition')) {
      condition = 'good';
    } else if (lowerLine.includes('fair') || lowerLine.includes('average')) {
      condition = 'fair';
    } else if (lowerLine.includes('poor') || lowerLine.includes('damaged') || lowerLine.includes('broken')) {
      condition = 'poor';
    }

    // Use the line as description if no structured data found
    const description = line.trim();

    if (description) {
      collaterals.push({
        type,
        description,
        estimatedValue,
        brand,
        model,
        year,
        serialNumber,
        condition: condition || 'good',
      });
    }
  }

  // If no structured extraction, create a single entry
  if (collaterals.length === 0 && text.trim()) {
    collaterals.push({
      type: 'other',
      description: text.trim(),
      condition: 'good',
    });
  }

  return collaterals;
}

