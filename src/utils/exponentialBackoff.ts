import { ServiceUnavailableException } from '@nestjs/common';

export function exponentialBackoff(retries: number, delay = 500): number {
  if (retries >= 2) throw new ServiceUnavailableException('Hive not responding');
  return delay * Math.pow(1.2, retries);
}
