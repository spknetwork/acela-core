import { NestFactory } from '@nestjs/core'
import { StorageClusterModule } from './cluster.module.js'

// for testing purposes using the cluster standalone only
const app = await NestFactory.create(StorageClusterModule)
await app.listen(3000)