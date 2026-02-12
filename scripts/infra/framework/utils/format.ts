/**
 * Formatting utilities.
 */

export function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} bytes`;
}

export function formatDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toISOString().split('T')[0];
}
