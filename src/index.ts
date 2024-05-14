import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function startup(): Promise<void> {
  // const core = new AcelaCore()

  // await core.start();

  const app = await NestFactory.create(AppModule, {
    cors: true,
  });
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe());
  const config = new DocumentBuilder().build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/api/v1/docs', app, document);
  await app.listen(4569);
}

void startup();

process.on('unhandledRejection', (error: Error) => {
  console.log('unhandledRejection', error.message);
});
