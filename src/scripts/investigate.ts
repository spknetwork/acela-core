// import Signature from "@hiveio/hive-js/lib/auth/ecc/src/Signature"
import { cryptoUtils, PrivateKey, Signature } from '@hiveio/dhive'
import hash from '@hiveio/hive-js/lib/auth/ecc/src/hash'
import { HiveClient } from '../utils/hiveClient'

void (async () => {
            
  const txData = await HiveClient.database.getTransaction('643587baa0621619976bb3ee6df144098bf52641')
  const buf = cryptoUtils.transactionDigest({
    expiration: txData.expiration,
    extensions: txData.extensions,
    operations: txData.operations,
    ref_block_num: txData.ref_block_num,
    ref_block_prefix: txData.ref_block_prefix,
  }, HiveClient.chainId)
  
  const sig = Signature.fromBuffer(Buffer.from(txData.signatures[0] ?? '', 'hex'))
  const publicKey = sig.recover(buf)
  console.log(publicKey.toString())
  if(publicKey.toString() === "STM6GKqLaqQubHReZHpx6PSYsMSGaGwU7azdsA4y8x8qvb3uNV9Ty") {
    console.log('Transaction from key', JSON.stringify(txData, null, 2))
  }
                // console.log(publicKey)
    // let offset = 1;
    // for( ; ; ) {
    //     // HiveClient.blockchain.getOperationsStream()
    //     const history = await HiveClient.database.getAccountHistory('anestuna', offset * -1, 1000)
    //     offset = offset + history.length
    //     for(let tx of history) {
    //         // console.log(tx)
            
    //         try {
        
    //             if((tx[1] as any).virtual_op === true) {
    //                 continue;
    //             }
    //             const txData = await HiveClient.database.getTransaction(tx[1].trx_id)
    //             const buf = cryptoUtils.transactionDigest({
    //               expiration: txData.expiration,
    //               extensions: txData.extensions,
    //               operations: txData.operations,
    //               ref_block_num: txData.ref_block_num,
    //               ref_block_prefix: txData.ref_block_prefix,
    //             }, HiveClient.chainId)
                
    //             const sig = Signature.fromBuffer(Buffer.from(txData.signatures[0], 'hex'))
    //             const publicKey = sig.recover(buf)
    //             if(publicKey.toString() === "STM6GKqLaqQubHReZHpx6PSYsMSGaGwU7azdsA4y8x8qvb3uNV9Ty") {
    //                 console.log('Emergency 202', JSON.stringify(txData, null, 2))
    //             }
    //             // console.log(publicKey)
    //         } catch {
    
    //         }
    //     }
    // }
})()
