export interface UserAccountLink {
  status: 'unverified' | 'verified';
  user_id: string;
  account: string;
  network: 'HIVE';
  type: 'native' | 'hive_keychain' | 'hive_auth';
  challenge?: string;
  linked_at: Date | null;
  verified_at: Date | null;
}

export interface UserAccount {
  user_id: string;
  status: 'unverified' | 'verified' | 'active';
  email_status: 'unverified' | 'verified';
  email: string;
  email_code: string;

  created_at: Date;
  updated_at: Date;
  last_login_at: Date;

  auth_methods: {
    password: {
      value: string;
    };
    [x: string]: any;
  };

  type: string;

  // userStatus: string
  // emailVerified: boolean
  // enabled: boolean
  // passwordResetRequested: boolean

  password_reset_at: Date | null;
}

export interface HiveAccountCreation {
  status: 'requested' | 'created' | 'released';
  username: string;
  keys_requested: boolean;
  created_by: string | null;
  requested_at: Date;
  created_at: Date;
  [x: string]: any;
}

export interface AuthSession {
  id: string;
  expires: Date;
  date: Date;
  type: 'singleton' | 'regular';
  sub: string;
}
