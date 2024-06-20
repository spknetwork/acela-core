
import { HiveRepository } from './hive.repository';
import { ExtendedAccount, PrivateKey } from '@hiveio/dhive';
import * as crypto from "crypto";

describe('HiveRepository', () => {
  let hiveRepository: HiveRepository;

  beforeEach(() => {
    hiveRepository = new HiveRepository();
  });

  describe('verifyHiveMessage', () => {
    it('Should fail to verify a bogus Hive message', async () => {
      // Arrange
      const redTeamPrivateKey = PrivateKey.fromSeed(crypto.randomBytes(32).toString("hex"));
      const blueTeamPrivateKey = PrivateKey.fromSeed(crypto.randomBytes(32).toString("hex"));
      const blueTeamPublicKey = blueTeamPrivateKey.createPublic();
      const blueTeamPublicKeyString = blueTeamPublicKey.toString();
  
      const message = JSON.stringify({ ts: Date.now() });
      const forgedSignature = redTeamPrivateKey.sign(crypto.createHash('sha256').update(message).digest());
  
      const account: ExtendedAccount = {
        name: 'blueteam',
        memo_key: blueTeamPublicKeyString,
        json_metadata: '',
        posting: {
          weight_threshold: 1,
          account_auths: [],
          key_auths: [[blueTeamPublicKeyString, 1]],
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
      const result = hiveRepository.verifyHiveMessage(
        crypto.createHash('sha256').update('different message').digest(),
        forgedSignature.toString(),
        account
      );
  
      // Assert
      expect(result).toBe(false);
    });
  
    it('Should successfully verify a valid Hive message', async () => {
      // Arrange
      const privateKey = PrivateKey.fromSeed(crypto.randomBytes(32).toString("hex"));
      const publicKey = privateKey.createPublic();
      const publicKeyString = publicKey.toString();
      const message = JSON.stringify({ ts: Date.now() });
      const signature = privateKey.sign(crypto.createHash('sha256').update(message).digest());
  
      const account: ExtendedAccount = {
        name: 'testaccount',
        memo_key: publicKeyString,
        json_metadata: '',
        posting: {
          weight_threshold: 1,
          account_auths: [],
          key_auths: [[publicKeyString, 1]],
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
        savings_hbd_seconds_last_update: '',
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
      const result = hiveRepository.verifyHiveMessage(
        crypto.createHash('sha256').update(message).digest(),
        signature.toString(),
        account
      );
  
      // Assert
      expect(result).toBe(true);
    });
  })

  describe('verifyPostingAuth', () => {
    it('Returns true if threespeak has posting authority over the account', async () => {
      process.env.DELEGATED_ACCOUNT = 'threespeak';
      const account = await hiveRepository.getAccount('starkerz');
      expect(hiveRepository.verifyPostingAuth(account)).toBe(true);
    })

    it('Returns false if threespeak does not have posting authority over the account', async () => {
      process.env.DELEGATED_ACCOUNT = 'threespeak';
      const account = await hiveRepository.getAccount('ned');
      expect(hiveRepository.verifyPostingAuth(account)).toBe(false);
    })
  })
});
