import { NestFactory } from '@nestjs/core';
import { AcelaCore } from './services';
import { ApiModule } from './services/api';
import { AppModule } from './app.module';

async function startup(): Promise<void> {

  const core = new AcelaCore()

  await core.start();

  const apiListener = new ApiModule(core, 4569)
  await apiListener.listen()
  
  const app = await NestFactory.create(AppModule);
  await app.init()
}

void startup()

process.on('unhandledRejection', (error: Error) => {
  console.log('unhandledRejection', error.message)
})
