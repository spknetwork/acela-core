import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LockRepository } from './repository/lock.repository';
import { Lock, LockSchema } from './schemas/lock.schema';
import { LockNodeRepository } from './repository/lock-node.repository';
import { LockService } from './service/lock.service';
import { LockNode, LockNodeSchema } from './schemas/lock-node.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Lock.name, schema: LockSchema }], 'acela-core'),
    MongooseModule.forFeature([{ name: LockNode.name, schema: LockNodeSchema }], 'acela-core')
  ],
  controllers: [],
  providers: [LockRepository, LockNodeRepository, LockService],
  exports: [LockRepository, LockNodeRepository, LockService]
})
export class LockModule {}