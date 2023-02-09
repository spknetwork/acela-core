import { NestFactory } from '@nestjs/core';
import { AppModule } from './services/api/app.module';

async function startup(): Promise<void> {
  console.log(`startup`)
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}

void startup()

process.on('unhandledRejection', (error: Error) => {
  console.log('unhandledRejection', error.message)
})
