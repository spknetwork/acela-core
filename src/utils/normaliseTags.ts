export function normaliseTags(tags: string): string[] {
  return Array.from(new Set(tags.split(',')
      .map(tag => tag.toLowerCase().replace(/[^a-z]/gi, ''))
      .filter(tag => tag.length > 0)));
}
