// Import statements for ConfigService
import { ConfigService } from '@nestjs/config';

/**
 * A factory function for instantiating services, choosing between real and mock implementations.
 * @param realService The class (constructor function) of the real service.
 * @param mockService The class (constructor function) of the mock service.
 * @param configService The NestJS ConfigService for accessing environment variables.
 * @param model Mongoose model for this repository
 * @returns An instance of the real or mock service, based on environment configuration.
 */
export function MockFactory<T, M>(
  realService: new (model?: M) => T,
  mockService: new (model?: M) => T,
  configService: ConfigService,
  model?: M
): T {
  const env = configService.get<string>('ENVIRONMENT');
  const mongoUrl = configService.get<string>('CORE_MONGODB_URL');

  const isLocal = env === 'local';
  const isStaging = env === 'staging';
  const isProd = env === 'prod';

  if (isLocal) {
    return new mockService(model);
  }

  if (isStaging) {
    return new realService(model);
  }

  if (isProd && mongoUrl === 'mongodb://mongo:27017') {
    throw new Error('Cannot use mock service in production with real database. Mongo url is set to default.')
  }

  if (isProd) {
    return new realService(model);
  }

  return new mockService(model);
}