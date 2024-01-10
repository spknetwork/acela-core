import { Module } from '@nestjs/common'
import { StorageClusterController } from './cluster.controller.js'
import { StorageClusterService } from './cluster.service.js'

@Module({
    controllers: [StorageClusterController],
    providers: [{
        provide: StorageClusterService,
        useFactory: () => {
            const dbName = process.env.IPFS_CLUSTER_DB_NAME || 'cluster'
            return new StorageClusterService(dbName);
        }
    }],
    exports: [StorageClusterService]
})
export class StorageClusterModule {}