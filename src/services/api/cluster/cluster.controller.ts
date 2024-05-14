import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { StorageClusterService } from './cluster.service.js';

@Controller('cluster')
export class StorageClusterController {
  constructor(private clusterService: StorageClusterService) {}

  @Get()
  ping(): any {
    return { ok: 1 };
  }

  @Post('/add')
  async addToCluster(
    @Body('cid') cid: string,
    @Body('type') type: string,
    @Body('network') network: string,
    @Body('owner') owner: string,
    @Body('permlink') permlink: string,
  ) {
    await this.clusterService.addToCluster(cid, { type, network, owner, permlink });
    return { success: true };
  }

  @Delete('/unpin/cluster')
  async unpinFromCluster(@Body('cid') cid: string) {
    await this.clusterService.unpinFromCluster(cid);
    return { success: true };
  }

  @Delete('/unpin/peer')
  async unpinFromPeer(@Body('cid') cid: string) {
    await this.clusterService.unpinFromPeer(cid);
    return { success: true };
  }
}
