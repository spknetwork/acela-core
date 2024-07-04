export async function exponentialBackoff(fn, retries = 5, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((res) => setTimeout(res, delay * Math.pow(2, i)));
    }
  }
}
