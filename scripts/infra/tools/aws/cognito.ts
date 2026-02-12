#!/usr/bin/env npx tsx
/**
 * Cognito Management Script
 * Manage Amazon Cognito User Pools: list, show, create, users, app-clients
 */

import { AwsCommand, lib } from '../../framework/command/AwsCommand.js';
import { toError } from '../../infrastructure/types.js';
import type { CommandDefinition, OptionDefinition } from '../../framework/types.js';

interface UserPool {
  Id: string;
  Name: string;
  Status?: string;
  CreationDate?: string;
  LastModifiedDate?: string;
  Arn?: string;
  EstimatedNumberOfUsers?: number;
  MfaConfiguration?: string;
  Policies?: {
    PasswordPolicy?: {
      MinimumLength?: number;
      RequireUppercase?: boolean;
      RequireLowercase?: boolean;
      RequireNumbers?: boolean;
      RequireSymbols?: boolean;
    };
  };
  SchemaAttributes?: Array<{ Name?: string; Required?: boolean }>;
}

interface UserPoolClient {
  ClientId: string;
  ClientName: string;
  ClientSecret?: string;
  ExplicitAuthFlows?: string[];
  AccessTokenValidity?: number;
  IdTokenValidity?: number;
}

interface CognitoUser {
  Username: string;
  UserStatus?: string;
  UserCreateDate?: string;
  Attributes?: Array<{ Name: string; Value: string }>;
}

class CognitoManage extends AwsCommand {
  static override name = 'cognito-manage';
  static service = 'cognito-idp';
  static override description = 'Amazon Cognito User Pool Management Script';

  static override commands: Record<string, CommandDefinition> = {
    list: { desc: 'List all Cognito User Pools', aliases: ['ls'], requireAws: true },
    show: { desc: 'Show User Pool details', args: '<pool-id>', aliases: ['info'], requireAws: true },
    create: { desc: 'Create a new User Pool', args: '<pool-name>', aliases: ['new'], requireAws: true },
    delete: { desc: 'Delete a User Pool', args: '<pool-id>', aliases: ['rm'], requireAws: true },
    users: { desc: 'List users in a User Pool', args: '<pool-id>', requireAws: true },
    'create-user': { desc: 'Create a new user', args: '<pool-id> <email>', requireAws: true },
    'delete-user': { desc: 'Delete a user', args: '<pool-id> <username>', requireAws: true },
    clients: { desc: 'List App Clients', args: '<pool-id>', requireAws: true },
    'create-client': { desc: 'Create an App Client', args: '<pool-id> <client-name>', requireAws: true },
    'delete-client': { desc: 'Delete an App Client', args: '<pool-id> <client-id>', requireAws: true },
    test: { desc: 'Test user authentication', args: '<pool-id> <client-id> <email> <password>', requireAws: true },
  };

  static override options: Record<string, OptionDefinition> = {
    '--password': { name: 'password', type: 'string', desc: 'Temporary password for new user' },
    '--mfa': { name: 'mfa', type: 'boolean', desc: 'Enable MFA (default: false)' },
    '--limit': { name: 'limit', type: 'string', desc: 'Limit results (default: 20)' },
    '--force': { name: 'force', type: 'boolean', desc: 'Skip confirmation prompt' },
  };

  // ============================================================
  // Commands
  // ============================================================

  async cmdList(): Promise<number> {
    lib.log.header('Cognito User Pools');

    lib.log.info(`Region: ${this.region}`);
    console.log('');

    const pools = this.listUserPools();

    if (pools.length === 0) {
      lib.log.info('No User Pools found');
      return 0;
    }

    lib.log.pass(`Found ${pools.length} User Pool(s)`);
    console.log('');

    const rows = pools.map((pool) => [
      pool.Name || '',
      pool.Id || '',
      pool.Status || '',
      lib.formatDate(pool.CreationDate),
    ]);

    this.formatTable(['NAME', 'POOL ID', 'STATUS', 'CREATED'], rows, [25, 30, 10, 20]);

    return 0;
  }

  async cmdShow(poolId?: string): Promise<number> {
    if (!poolId) {
      lib.log.fail('Pool ID is required');
      console.log('');
      console.log('Usage: node cognito-manage.js show <pool-id>');
      console.log('');
      console.log('Tip: Run "node cognito-manage.js list" to find Pool IDs');
      return 1;
    }

    if (!this.validate(() => this.validateName(poolId, 'pool ID'))) {
      return 1;
    }

    lib.log.header(`Cognito User Pool: ${poolId}`);

    const pool = this.describeUserPool(poolId);
    if (!pool) {
      lib.log.fail(`User Pool '${poolId}' not found`);
      return 1;
    }

    // Basic Info
    lib.log.section('Pool Information');
    console.log(`  Name:           ${pool.Name}`);
    console.log(`  ID:             ${pool.Id}`);
    console.log(`  ARN:            ${pool.Arn}`);
    console.log(`  Status:         ${pool.Status}`);
    console.log(`  Created:        ${lib.formatDate(pool.CreationDate)}`);
    console.log(`  Last Modified:  ${lib.formatDate(pool.LastModifiedDate)}`);

    // Password Policy
    lib.log.section('Password Policy');
    const pwPolicy = pool.Policies?.PasswordPolicy || {};
    console.log(`  Min Length:           ${pwPolicy.MinimumLength || 8}`);
    console.log(`  Require Uppercase:    ${pwPolicy.RequireUppercase ? 'Yes' : 'No'}`);
    console.log(`  Require Lowercase:    ${pwPolicy.RequireLowercase ? 'Yes' : 'No'}`);
    console.log(`  Require Numbers:      ${pwPolicy.RequireNumbers ? 'Yes' : 'No'}`);
    console.log(`  Require Symbols:      ${pwPolicy.RequireSymbols ? 'Yes' : 'No'}`);

    // MFA Configuration
    lib.log.section('MFA Configuration');
    console.log(`  MFA:            ${pool.MfaConfiguration || 'OFF'}`);

    // User Stats
    lib.log.section('User Statistics');
    console.log(`  Estimated Users: ${pool.EstimatedNumberOfUsers || 0}`);

    // Schema Attributes
    lib.log.section('Schema Attributes');
    const attrs = pool.SchemaAttributes || [];
    const customAttrs = attrs.filter((a) => a.Name?.startsWith('custom:'));
    const standardAttrs = attrs.filter((a) => !a.Name?.startsWith('custom:') && a.Required);

    console.log(`  Standard (required): ${standardAttrs.map((a) => a.Name).join(', ') || 'none'}`);
    console.log(`  Custom:              ${customAttrs.map((a) => a.Name).join(', ') || 'none'}`);

    // App Clients
    lib.log.section('App Clients');
    const clients = this.listUserPoolClients(poolId);
    if (clients.length === 0) {
      console.log('  No App Clients configured');
    } else {
      for (const client of clients) {
        console.log(`  - ${client.ClientName} (${client.ClientId})`);
      }
    }

    // Usage hints
    console.log('');
    lib.log.info('Useful commands:');
    lib.log.info(`  Users:    node cognito-manage.js users ${poolId}`);
    lib.log.info(`  Clients:  node cognito-manage.js clients ${poolId}`);
    lib.log.info(`  Add User: node cognito-manage.js create-user ${poolId} user@example.com`);

    return 0;
  }

  async cmdCreate(poolName?: string): Promise<number> {
    const enableMfa = (this.options.mfa as boolean) || false;

    if (!poolName) {
      lib.log.fail('Pool name is required');
      console.log('');
      console.log('Usage: node cognito-manage.js create <pool-name>');
      console.log('');
      console.log('Options:');
      console.log('  --mfa    Enable MFA (default: false)');
      return 1;
    }

    if (!this.validate(() => this.validateName(poolName, 'pool name'))) {
      return 1;
    }

    lib.log.header(`Create Cognito User Pool: ${poolName}`);
    lib.log.info(`Region: ${this.region}`);
    lib.log.info(`Pool Name: ${poolName}`);
    lib.log.info(`MFA: ${enableMfa ? 'Enabled' : 'Disabled'}`);
    console.log('');

    try {
      // Create User Pool
      const pool = this._createUserPool(poolName, enableMfa);
      lib.log.pass('User Pool created');
      console.log(`  Pool ID:  ${pool.Id}`);
      console.log(`  Name:     ${pool.Name}`);
      console.log(`  ARN:      ${pool.Arn}`);

      // Create default App Client
      const client = this._createAppClient(pool.Id, poolName);
      lib.log.pass('App Client created');
      console.log(`  Client ID:   ${client.ClientId}`);
      console.log(`  Client Name: ${client.ClientName}`);

      // Summary
      this._showCreateSummary(pool, client);
      return 0;
    } catch (error: unknown) {
      lib.log.fail(`Failed to create User Pool: ${toError(error).message}`);
      return 1;
    }
  }

  private _createUserPool(poolName: string, enableMfa: boolean): UserPool {
    lib.log.section('Creating User Pool');

    const config = {
      PoolName: poolName,
      Policies: {
        PasswordPolicy: {
          MinimumLength: 8,
          RequireUppercase: true,
          RequireLowercase: true,
          RequireNumbers: true,
          RequireSymbols: false,
          TemporaryPasswordValidityDays: 7,
        },
      },
      AutoVerifiedAttributes: ['email'],
      UsernameAttributes: ['email'],
      MfaConfiguration: enableMfa ? 'OPTIONAL' : 'OFF',
      Schema: [
        { Name: 'email', AttributeDataType: 'String', Required: true, Mutable: true },
        { Name: 'name', AttributeDataType: 'String', Required: false, Mutable: true },
      ],
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: false },
      AccountRecoverySetting: {
        RecoveryMechanisms: [{ Priority: 1, Name: 'verified_email' }],
      },
    };

    const result = lib.run(
      `aws cognito-idp create-user-pool --cli-input-json '${JSON.stringify(config)}' --region ${this.region} --output json`,
      { ignoreError: false }
    );
    return JSON.parse(result).UserPool;
  }

  private _createAppClient(poolId: string, poolName: string): UserPoolClient {
    lib.log.section('Creating Default App Client');

    const config = {
      UserPoolId: poolId,
      ClientName: `${poolName}-client`,
      GenerateSecret: false,
      ExplicitAuthFlows: ['ALLOW_USER_PASSWORD_AUTH', 'ALLOW_USER_SRP_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
      PreventUserExistenceErrors: 'ENABLED',
    };

    const result = lib.run(
      `aws cognito-idp create-user-pool-client --cli-input-json '${JSON.stringify(config)}' --region ${this.region} --output json`,
      { ignoreError: false }
    );
    return JSON.parse(result).UserPoolClient;
  }

  private _showCreateSummary(pool: UserPool, client: UserPoolClient): void {
    console.log('');
    lib.log.pass('User Pool setup completed!');
    console.log('');
    lib.log.info('Environment variables for your app:');
    console.log(`  COGNITO_USER_POOL_ID=${pool.Id}`);
    console.log(`  COGNITO_CLIENT_ID=${client.ClientId}`);
    console.log(`  COGNITO_REGION=${this.region}`);
    console.log('');
    lib.log.info('Useful commands:');
    lib.log.info(`  Show:       node cognito-manage.js show ${pool.Id}`);
    lib.log.info(`  Add User:   node cognito-manage.js create-user ${pool.Id} user@example.com`);
  }

  async cmdDelete(poolId?: string): Promise<number> {
    if (!poolId) {
      lib.log.fail('Pool ID is required');
      console.log('');
      console.log('Usage: node cognito-manage.js delete <pool-id>');
      return 1;
    }

    if (!this.validate(() => this.validateName(poolId, 'pool ID'))) {
      return 1;
    }

    lib.log.header(`Delete Cognito User Pool: ${poolId}`);

    const pool = this.describeUserPool(poolId);
    if (!pool) {
      lib.log.fail(`User Pool '${poolId}' not found`);
      return 1;
    }

    lib.log.info(`Pool Name: ${pool.Name}`);
    lib.log.info(`Pool ID: ${pool.Id}`);
    lib.log.info(`Users: ${pool.EstimatedNumberOfUsers || 0}`);
    console.log('');

    // Confirm deletion
    if (!this.options.force) {
      lib.log.warn('This will permanently delete the User Pool and all its users!');
      if (!await lib.confirm('Are you sure you want to delete this User Pool?')) {
        lib.log.info('Cancelled');
        return 0;
      }
    }

    // First, delete all App Clients (required before deleting the pool)
    const clients = this.listUserPoolClients(poolId);
    if (clients.length > 0) {
      lib.log.section('Deleting App Clients');
      for (const client of clients) {
        try {
          lib.run(
            `aws cognito-idp delete-user-pool-client --user-pool-id ${poolId} --client-id ${client.ClientId} --region ${this.region}`,
            { ignoreError: false }
          );
          lib.log.pass(`Deleted client: ${client.ClientName}`);
        } catch (e: unknown) {
          lib.log.warn(`Failed to delete client ${client.ClientName}: ${toError(e).message}`);
        }
      }
    }

    // Delete the User Pool
    lib.log.section('Deleting User Pool');
    try {
      lib.run(
        `aws cognito-idp delete-user-pool --user-pool-id ${poolId} --region ${this.region}`,
        { ignoreError: false }
      );
      lib.log.pass(`User Pool '${pool.Name}' deleted successfully`);
      return 0;
    } catch (error: unknown) {
      lib.log.fail(`Failed to delete User Pool: ${toError(error).message}`);
      return 1;
    }
  }

  async cmdUsers(poolId?: string): Promise<number> {
    const limit = parseInt(this.options.limit as string, 10) || 20;

    if (!poolId) {
      lib.log.fail('Pool ID is required');
      console.log('');
      console.log('Usage: node cognito-manage.js users <pool-id>');
      return 1;
    }

    if (!this.validate(() => this.validateName(poolId, 'pool ID'))) {
      return 1;
    }

    lib.log.header(`Users in Pool: ${poolId}`);

    const users = this.listUsers(poolId, limit);

    if (users.length === 0) {
      lib.log.info('No users found');
      return 0;
    }

    lib.log.pass(`Found ${users.length} user(s)`);
    console.log('');

    const rows = users.map((user) => {
      const email = user.Attributes?.find((a) => a.Name === 'email')?.Value || '-';
      const emailVerified = user.Attributes?.find((a) => a.Name === 'email_verified')?.Value || '-';
      return [
        user.Username?.substring(0, 30) || '',
        email,
        user.UserStatus || '',
        emailVerified,
        lib.formatDate(user.UserCreateDate),
      ];
    });

    this.formatTable(['USERNAME', 'EMAIL', 'STATUS', 'VERIFIED', 'CREATED'], rows, [32, 30, 15, 10, 15]);

    return 0;
  }

  async ['cmdCreate-user'](poolId?: string, email?: string): Promise<number> {
    const tempPassword = (this.options.password as string) || this.generateTempPassword();

    if (!poolId || !email) {
      lib.log.fail('Pool ID and email are required');
      console.log('');
      console.log('Usage: node cognito-manage.js create-user <pool-id> <email>');
      console.log('');
      console.log('Options:');
      console.log('  --password <pass>  Temporary password (auto-generated if not provided)');
      return 1;
    }

    if (!this.validate(() => {
      this.validateName(poolId, 'pool ID');
      this.validateEmail(email);
    })) {
      return 1;
    }

    lib.log.header(`Create User: ${email}`);

    lib.log.info(`Pool ID: ${poolId}`);
    lib.log.info(`Email: ${email}`);
    console.log('');

    // Create user
    lib.log.section('Creating User');

    try {
      const result = lib.run(
        `aws cognito-idp admin-create-user \
          --user-pool-id ${poolId} \
          --username "${email}" \
          --user-attributes Name=email,Value="${email}" Name=email_verified,Value=true \
          --temporary-password "${tempPassword}" \
          --message-action SUPPRESS \
          --region ${this.region} --output json`,
        { ignoreError: false }
      );

      const response = JSON.parse(result);
      const user = response.User;

      lib.log.pass('User created');
      console.log('');
      console.log(`  Username:  ${user.Username}`);
      console.log(`  Email:     ${email}`);
      console.log(`  Status:    ${user.UserStatus}`);
      console.log(`  Temp Pass: ${tempPassword}`);
      console.log('');
      lib.log.warn('User must change password on first login');
      console.log('');
      lib.log.info('To set permanent password:');
      lib.log.info(
        `  aws cognito-idp admin-set-user-password --user-pool-id ${poolId} --username "${email}" --password "NewPassword123!" --permanent`
      );

      return 0;
    } catch (error: unknown) {
      const err = toError(error);
      if (err.message?.includes('UsernameExistsException')) {
        lib.log.fail(`User '${email}' already exists`);
      } else {
        lib.log.fail(`Failed to create user: ${err.message}`);
      }
      return 1;
    }
  }

  async ['cmdDelete-user'](poolId?: string, username?: string): Promise<number> {
    if (!poolId || !username) {
      lib.log.fail('Pool ID and username are required');
      console.log('');
      console.log('Usage: node cognito-manage.js delete-user <pool-id> <username>');
      return 1;
    }

    if (!this.validate(() => this.validateNames([poolId, 'pool ID'], [username, 'username']))) {
      return 1;
    }

    lib.log.header(`Delete User: ${username}`);

    lib.log.info(`Pool ID: ${poolId}`);
    lib.log.info(`Username: ${username}`);
    console.log('');

    // Confirm deletion
    if (!this.options.force) {
      if (!await lib.confirm(`Are you sure you want to delete user '${username}'?`)) {
        lib.log.info('Cancelled');
        return 0;
      }
    }

    try {
      lib.run(
        `aws cognito-idp admin-delete-user --user-pool-id ${poolId} --username "${username}" --region ${this.region}`,
        { ignoreError: false }
      );
      lib.log.pass(`User '${username}' deleted successfully`);
      return 0;
    } catch (error: unknown) {
      const err = toError(error);
      if (err.message?.includes('UserNotFoundException')) {
        lib.log.fail(`User '${username}' not found`);
      } else {
        lib.log.fail(`Failed to delete user: ${err.message}`);
      }
      return 1;
    }
  }

  async cmdClients(poolId?: string): Promise<number> {
    if (!poolId) {
      lib.log.fail('Pool ID is required');
      console.log('');
      console.log('Usage: node cognito-manage.js clients <pool-id>');
      return 1;
    }

    if (!this.validate(() => this.validateName(poolId, 'pool ID'))) {
      return 1;
    }

    lib.log.header(`App Clients for Pool: ${poolId}`);

    const clients = this.listUserPoolClients(poolId);

    if (clients.length === 0) {
      lib.log.info('No App Clients found');
      return 0;
    }

    lib.log.pass(`Found ${clients.length} App Client(s)`);
    console.log('');

    for (const client of clients) {
      const details = this.describeUserPoolClient(poolId, client.ClientId);
      if (details) {
        lib.log.section(client.ClientName);
        console.log(`  Client ID:      ${details.ClientId}`);
        console.log(`  Client Secret:  ${details.ClientSecret ? '***' : 'None'}`);
        console.log(`  Auth Flows:     ${(details.ExplicitAuthFlows || []).join(', ')}`);
        console.log(`  Token Validity: Access=${details.AccessTokenValidity || 60}min, ID=${details.IdTokenValidity || 60}min`);
      }
    }

    return 0;
  }

  async ['cmdCreate-client'](poolId?: string, clientName?: string): Promise<number> {
    if (!poolId || !clientName) {
      lib.log.fail('Pool ID and client name are required');
      console.log('');
      console.log('Usage: node cognito-manage.js create-client <pool-id> <client-name>');
      return 1;
    }

    if (!this.validate(() => this.validateNames([poolId, 'pool ID'], [clientName, 'client name']))) {
      return 1;
    }

    lib.log.header(`Create App Client: ${clientName}`);

    lib.log.info(`Pool ID: ${poolId}`);
    lib.log.info(`Client Name: ${clientName}`);
    console.log('');

    const config = {
      UserPoolId: poolId,
      ClientName: clientName,
      GenerateSecret: false,
      ExplicitAuthFlows: [
        'ALLOW_USER_PASSWORD_AUTH',
        'ALLOW_USER_SRP_AUTH',
        'ALLOW_REFRESH_TOKEN_AUTH',
      ],
      PreventUserExistenceErrors: 'ENABLED',
    };

    try {
      const result = lib.run(
        `aws cognito-idp create-user-pool-client --cli-input-json '${JSON.stringify(config)}' --region ${this.region} --output json`,
        { ignoreError: false }
      );

      const response = JSON.parse(result);
      const client = response.UserPoolClient;

      lib.log.pass('App Client created');
      console.log('');
      console.log(`  Client ID:   ${client.ClientId}`);
      console.log(`  Client Name: ${client.ClientName}`);
      console.log('');
      lib.log.info('Environment variable:');
      console.log(`  COGNITO_CLIENT_ID=${client.ClientId}`);

      return 0;
    } catch (error: unknown) {
      lib.log.fail(`Failed to create App Client: ${toError(error).message}`);
      return 1;
    }
  }

  async ['cmdDelete-client'](poolId?: string, clientId?: string): Promise<number> {
    if (!poolId || !clientId) {
      lib.log.fail('Pool ID and Client ID are required');
      console.log('');
      console.log('Usage: node cognito-manage.js delete-client <pool-id> <client-id>');
      return 1;
    }

    if (!this.validate(() => this.validateNames([poolId, 'pool ID'], [clientId, 'client ID']))) {
      return 1;
    }

    lib.log.header(`Delete App Client: ${clientId}`);

    // Get client details first
    const client = this.describeUserPoolClient(poolId, clientId);
    if (!client) {
      lib.log.fail(`App Client '${clientId}' not found`);
      return 1;
    }

    lib.log.info(`Pool ID: ${poolId}`);
    lib.log.info(`Client ID: ${clientId}`);
    lib.log.info(`Client Name: ${client.ClientName}`);
    console.log('');

    // Confirm deletion
    if (!this.options.force) {
      if (!await lib.confirm(`Are you sure you want to delete App Client '${client.ClientName}'?`)) {
        lib.log.info('Cancelled');
        return 0;
      }
    }

    try {
      lib.run(
        `aws cognito-idp delete-user-pool-client --user-pool-id ${poolId} --client-id ${clientId} --region ${this.region}`,
        { ignoreError: false }
      );
      lib.log.pass(`App Client '${client.ClientName}' deleted successfully`);
      return 0;
    } catch (error: unknown) {
      lib.log.fail(`Failed to delete App Client: ${toError(error).message}`);
      return 1;
    }
  }

  async cmdTest(poolId?: string, clientId?: string, email?: string, password?: string): Promise<number> {
    if (!poolId || !clientId || !email || !password) {
      lib.log.fail('Pool ID, Client ID, email, and password are required');
      console.log('');
      console.log('Usage: node cognito-manage.js test <pool-id> <client-id> <email> <password>');
      return 1;
    }

    if (!this.validate(() => {
      this.validateNames([poolId, 'pool ID'], [clientId, 'client ID']);
      this.validateEmail(email);
    })) {
      return 1;
    }

    lib.log.header('Test Authentication');

    lib.log.info(`Pool ID: ${poolId}`);
    lib.log.info(`Client ID: ${clientId}`);
    lib.log.info(`Email: ${email}`);
    console.log('');

    lib.log.section('Initiating Authentication');

    try {
      const result = lib.run(
        `aws cognito-idp initiate-auth \
          --auth-flow USER_PASSWORD_AUTH \
          --client-id ${clientId} \
          --auth-parameters USERNAME="${email}",PASSWORD="${password}" \
          --region ${this.region} --output json`,
        { ignoreError: false }
      );

      const response = JSON.parse(result);

      if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        lib.log.warn('Password change required');
        console.log('');
        console.log('  Challenge: NEW_PASSWORD_REQUIRED');
        console.log('  Session:   ' + response.Session?.substring(0, 50) + '...');
        console.log('');
        lib.log.info('To set new password:');
        lib.log.info(
          `  aws cognito-idp admin-set-user-password --user-pool-id ${poolId} --username "${email}" --password "NewPassword123!" --permanent`
        );
        return 1;
      }

      if (response.AuthenticationResult) {
        lib.log.pass('Authentication successful!');
        console.log('');
        console.log(`  Access Token:  ${response.AuthenticationResult.AccessToken?.substring(0, 50)}...`);
        console.log(`  ID Token:      ${response.AuthenticationResult.IdToken?.substring(0, 50)}...`);
        console.log(`  Refresh Token: ${response.AuthenticationResult.RefreshToken?.substring(0, 50)}...`);
        console.log(`  Expires In:    ${response.AuthenticationResult.ExpiresIn} seconds`);
        return 0;
      }

      lib.log.warn('Unexpected response');
      console.log(JSON.stringify(response, null, 2));
      return 1;
    } catch (error: unknown) {
      const err = toError(error);
      if (err.message?.includes('NotAuthorizedException')) {
        lib.log.fail('Invalid username or password');
      } else if (err.message?.includes('UserNotFoundException')) {
        lib.log.fail('User not found');
      } else {
        lib.log.fail(`Authentication failed: ${err.message}`);
      }
      return 1;
    }
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  listUserPools(): UserPool[] {
    const result = lib.run(
      `aws cognito-idp list-user-pools --max-results 60 --region ${this.region} --output json`,
      { ignoreError: true }
    );
    if (!result) return [];
    try {
      const data = JSON.parse(result);
      return data.UserPools || [];
    } catch {
      return [];
    }
  }

  describeUserPool(poolId: string): UserPool | null {
    const result = lib.run(
      `aws cognito-idp describe-user-pool --user-pool-id ${poolId} --region ${this.region} --output json`,
      { ignoreError: true }
    );
    if (!result) return null;
    try {
      const data = JSON.parse(result);
      return data.UserPool;
    } catch {
      return null;
    }
  }

  listUsers(poolId: string, limit = 20): CognitoUser[] {
    const result = lib.run(
      `aws cognito-idp list-users --user-pool-id ${poolId} --limit ${limit} --region ${this.region} --output json`,
      { ignoreError: true }
    );
    if (!result) return [];
    try {
      const data = JSON.parse(result);
      return data.Users || [];
    } catch {
      return [];
    }
  }

  listUserPoolClients(poolId: string): UserPoolClient[] {
    const result = lib.run(
      `aws cognito-idp list-user-pool-clients --user-pool-id ${poolId} --max-results 60 --region ${this.region} --output json`,
      { ignoreError: true }
    );
    if (!result) return [];
    try {
      const data = JSON.parse(result);
      return data.UserPoolClients || [];
    } catch {
      return [];
    }
  }

  describeUserPoolClient(poolId: string, clientId: string): UserPoolClient | null {
    const result = lib.run(
      `aws cognito-idp describe-user-pool-client --user-pool-id ${poolId} --client-id ${clientId} --region ${this.region} --output json`,
      { ignoreError: true }
    );
    if (!result) return null;
    try {
      const data = JSON.parse(result);
      return data.UserPoolClient;
    } catch {
      return null;
    }
  }

  generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password + '!1Aa';
  }
}

CognitoManage.main();
