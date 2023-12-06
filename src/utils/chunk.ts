export function chunk<T>(arr: T[], chunkSize: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / chunkSize) }, (v, i) => 
      arr.slice(i * chunkSize, i * chunkSize + chunkSize)
  );
}