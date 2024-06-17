// hiveRepository.spec.ts

import { HiveRepository } from './hive.repository';
import { ExtendedAccount } from '@hiveio/dhive';
import { PublicKey, Signature } from '@hiveio/dhive';

describe('HiveRepository', () => {
  let hiveRepository: HiveRepository;

  beforeEach(() => {
    hiveRepository = new HiveRepository();
  });

  it('Should fail to verify a bogus Hive message', () => {
    // Arrange
    const message = Buffer.from('test message');
    const signature = 'abcdef1234567890'; // Replace with a valid signature for a real test
    const account: ExtendedAccount = {
      name: 'testaccount',
      memo_key: 'STM8EvPiXjjP2e8vHVwQAbz9wbVUXT2JGRy6kbjpuDFVUtY6bFtFr',
      json_metadata: '',
      posting: {
        weight_threshold: 1,
        account_auths: [],
        key_auths: [['STM8EvPiXjjP2e8vHVwQAbz9wbVUXT2JGRy6kbjpuDFVUtY6bFtFr', 1]],
      },
      active: {
        weight_threshold: 1,
        account_auths: [],
        key_auths: [],
      },
      owner: {
        weight_threshold: 1,
        account_auths: [],
        key_auths: [],
      },
      proxy: '',
      last_owner_update: '',
      last_account_update: '',
      created: '',
      mined: false,
      recovery_account: '',
      last_account_recovery: '',
      reset_account: '',
      comment_count: 0,
      lifetime_vote_count: 0,
      post_count: 0,
      can_vote: true,
      voting_manabar: {
        current_mana: '0',
        last_update_time: 0,
      },
      voting_power: 0,
      balance: '',
      savings_balance: '',
      hbd_balance: '',
      hbd_seconds: '0',
      hbd_seconds_last_update: '',
      hbd_last_interest_payment: '',
      savings_hbd_balance: '',
      savings_hbd_seconds: '0',
      savings_hbd_seconds_last_update: '',
      savings_hbd_last_interest_payment: '',
      savings_withdraw_requests: 0,
      reward_hbd_balance: '',
      reward_hive_balance: '',
      reward_vesting_balance: '',
      reward_vesting_hive: '',
      vesting_shares: '',
      delegated_vesting_shares: '',
      received_vesting_shares: '',
      vesting_withdraw_rate: '',
      next_vesting_withdrawal: '',
      withdrawn: 0,
      to_withdraw: 0,
      withdraw_routes: 0,
      curation_rewards: 0,
      posting_rewards: 0,
      proxied_vsf_votes: [0],
      witnesses_voted_for: 0,
      last_post: '',
      last_root_post: '',
      last_vote_time: '',
      vesting_balance: '',
      reputation: '0',
      transfer_history: [],
      market_history: [],
      post_history: [],
      vote_history: [],
      other_history: [],
      witness_votes: [],
      tags_usage: [],
      guest_bloggers: [],
      id: 0,
      posting_json_metadata: '',
      owner_challenged: false,
      active_challenged: false,
      last_owner_proved: '',
      last_active_proved: '',
      average_bandwidth: '',
      lifetime_bandwidth: '',
      last_bandwidth_update: '',
      average_market_bandwidth: '',
      lifetime_market_bandwidth: '',
      last_market_bandwidth_update: ''
    };

    // Act
    const result = hiveRepository.verifyHiveMessage(message, signature, account);

    // Assert
    expect(result).toBe(false);
  });
});
