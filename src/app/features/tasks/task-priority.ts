export function getPriorityLabel(priority: number): string {
  if (priority === 1) return 'Düşük';
  if (priority === 2) return 'Orta';
  if (priority === 3) return 'Yüksek';
  return 'Belirsiz';
}

export function getPriorityClass(priority: number): string {
  if (priority === 1) return 'tag-low';
  if (priority === 2) return 'tag-mid';
  if (priority === 3) return 'tag-high';
  return '';
}
