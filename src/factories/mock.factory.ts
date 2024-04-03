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
  if (env !== 'prod' && mongoUrl !== 'mongodb://mongo:27017') {
    return new mockService(model);
  } else {
    return new realService(model);
  }
}