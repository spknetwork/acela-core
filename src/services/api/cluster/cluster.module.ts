import { Module } from '@nestjs/common'
import { StorageClusterController } from './cluster.controller.js'
import { StorageClusterService } from './cluster.service.js'

@Module({
    controllers: [StorageClusterController],
    providers: [{
        provide: StorageClusterService,
        useFactory: () => {
            const dbName = 'cluster'
            return new StorageClusterService(dbName);
        }
    }],
    exports: [StorageClusterService]
})
export class StorageClusterModule {}