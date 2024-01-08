import { Module } from '@nestjs/common';
import { AppService } from './app.services';
import { ApiModule, UsersModule } from './api.modules';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { LocalStrategy } from './auth/auth.strategy';
import { UploadController } from './uploader/upload.controller';
import { StorageClusterModule } from './cluster/cluster.module';

@Module({
  imports: [ AuthModule, UsersModule, ApiModule, ...(process.env.IPFS_CLUSTER_NEST_API_ENABLE === '1' || process.env.IPFS_CLUSTER_NEST_API_ENABLE === 'true' ? [StorageClusterModule] : []) ],
  controllers: [ AppController, UploadController ],
  providers: [ AppService, AuthModule, LocalStrategy ],
})
export class AppModule {}   