/** Hide misparsed EMI values shown as original price (e.g. "₹5,860" instead of "₹3.8 L"). */
export function displayOriginalPrice(
  originalPrice?: string,
  emi?: string
): string | null {
  if (!originalPrice?.trim()) return null;
  const orig = originalPrice.trim();
  if (/lakh|L|cr/i.test(orig)) return orig;
  if (/^\₹[\d,]+$/.test(orig) && emi) return null;
  return orig;
}
