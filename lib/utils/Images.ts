import { InventoryItem } from '@/lib/types/inventory';

/**
 * Resolves all image URLs for an inventory item.
 * Supports both old single-image records (imageUrl) and new multi-image records (imageUrls).
 * Always returns a flat string array — empty array if no images.
 *
 * Priority:
 *   1. imageUrls[] if present and non-empty  → use as-is
 *   2. imageUrl if present                   → wrap in array for uniform handling
 *   3. neither                               → return []
 */
export function resolveImages(item: InventoryItem): string[] {
  if (item.imageUrls && item.imageUrls.length > 0) return item.imageUrls;
  if (item.imageUrl) return [item.imageUrl];
  return [];
}

/**
 * Returns the primary (first) image URL for thumbnail display.
 * Returns null if the item has no images.
 */
export function resolvePrimaryImage(item: InventoryItem): string | null {
  const imgs = resolveImages(item);
  return imgs.length > 0 ? imgs[0] : null;
}