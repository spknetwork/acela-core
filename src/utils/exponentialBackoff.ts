export async function exponentialBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((res) => setTimeout(res, delay * Math.pow(2, i)));
    }
  }
  // Adding this to satisfy the compiler, although it should never reach here
  throw new Error('Exponential backoff failed');
}
