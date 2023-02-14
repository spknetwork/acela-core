import { NestFactory } from '@nestjs/core';
import { AcelaCore } from './services';
import { ApiModule } from './services/api';
import { AppModule } from './services/api/app.module';

async function startup(): Promise<void> {

  const core = new AcelaCore()

  await core.start();

  
  console.log(`startup`)
  // const app = await NestFactory.create(AppModule);
  // await app.listen(3000);

  const apiListener = new ApiModule(core, 4569)
  await apiListener.listen()
}

void startup()

process.on('unhandledRejection', (error: Error) => {
  console.log('unhandledRejection', error.message)
})
