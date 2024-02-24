import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionRepository } from './session.repository';
import { SessionSchema } from './schemas/session.schema';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'auth_sessions', schema: SessionSchema }], 'acela-core'),
    ConfigModule,
  ],
  controllers: [],
  providers: [SessionRepository],
  exports: [SessionRepository]
})
export class SessionModule {}