#!/usr/bin/env npx tsx
/**
 * Firehose Management Script
 * Manage Amazon Kinesis Data Firehose: list, show, create, test
 */

import { AwsCommand, lib } from '../../framework/command/AwsCommand.js';
import { toError } from '../../infrastructure/types.js';
import type { CommandDefinition, OptionDefinition } from '../../framework/types.js';

interface DeliveryStreamDescription {
  DeliveryStreamName: string;
  DeliveryStreamARN: string;
  DeliveryStreamStatus: string;
  DeliveryStreamType: string;
  CreateTimestamp?: string;
  Destinations?: Array<{
    S3DestinationDescription?: {
      BucketARN: string;
      Prefix?: string;
      CompressionFormat?: string;
      BufferingHints?: {
        SizeInMBs?: number;
        IntervalInSeconds?: number;
      };
    };
    ExtendedS3DestinationDescription?: {
      BucketARN: string;
      Prefix?: string;
      CompressionFormat?: string;
      BufferingHints?: {
        SizeInMBs?: number;
        IntervalInSeconds?: number;
      };
    };
    RedshiftDestinationDescription?: unknown;
    ElasticsearchDestinationDescription?: unknown;
    SplunkDestinationDescription?: unknown;
    HttpEndpointDestinationDescription?: unknown;
  }>;
  Source?: {
    KinesisStreamSourceDescription?: {
      KinesisStreamARN: string;
    };
  };
}

interface DeliveryStreamDetails {
  DeliveryStreamDescription: DeliveryStreamDescription;
}

class FirehoseManage extends AwsCommand {
  static override name = 'firehose-manage';
  static service = 'firehose';
  static override description = 'Kinesis Data Firehose Management Script';

  static override commands: Record<string, CommandDefinition> = {
    list: { desc: 'List all Firehose delivery streams', aliases: ['ls'], requireAws: true },
    show: { desc: 'Show delivery stream details', args: '<stream-name>', aliases: ['info'], requireAws: true },
    create: { desc: 'Create a new delivery stream (S3 destination)', args: '<stream-name> <s3-bucket>', aliases: ['new'], requireAws: true },
    delete: { desc: 'Delete a delivery stream', args: '<stream-name>', aliases: ['rm'], requireAws: true },
    status: { desc: 'Check delivery stream status', args: '<stream-name>', requireAws: true },
    test: { desc: 'Send a test record to stream', args: '<stream-name>', requireAws: true },
  };

  static override options: Record<string, OptionDefinition> = {
    '--prefix': { name: 'prefix', type: 'string', desc: 'S3 prefix for delivery (default: logs/)' },
    '--buffer-size': { name: 'bufferSize', type: 'string', desc: 'Buffer size in MB (default: 5)' },
    '--buffer-interval': { name: 'bufferInterval', type: 'string', desc: 'Buffer interval in seconds (default: 300)' },
    '--force': { name: 'force', type: 'boolean', desc: 'Skip confirmation prompt' },
  };

  // ============================================================
  // Commands
  // ============================================================

  async cmdList(): Promise<number> {
    lib.log.header('Kinesis Data Firehose Delivery Streams');

    lib.log.info(`Region: ${this.region}`);
    console.log('');

    const streams = this.listDeliveryStreams();

    if (streams.length === 0) {
      lib.log.info('No delivery streams found');
      return 0;
    }

    lib.log.pass(`Found ${streams.length} delivery stream(s)`);
    console.log('');

    const rows: string[][] = [];
    for (const streamName of streams) {
      const details = this.describeDeliveryStream(streamName);
      const status = details?.DeliveryStreamDescription?.DeliveryStreamStatus || 'UNKNOWN';
      const destType = this.getDestinationType(details);
      rows.push([streamName, status, destType]);
    }

    this.formatTable(['STREAM NAME', 'STATUS', 'DESTINATION'], rows, [40, 15, 20]);

    return 0;
  }

  async cmdShow(streamName?: string): Promise<number> {
    if (!streamName) {
      lib.log.fail('Stream name is required');
      console.log('');
      console.log('Usage: node firehose-manage.js show <stream-name>');
      return 1;
    }

    if (!this.validate(() => this.validateName(streamName, 'stream'))) {
      return 1;
    }

    lib.log.header(`Firehose Stream: ${streamName}`);

    lib.log.info(`Region: ${this.region}`);
    console.log('');

    const details = this.describeDeliveryStream(streamName);
    if (!details) {
      lib.log.fail(`Stream '${streamName}' not found`);
      return 1;
    }

    const desc = details.DeliveryStreamDescription;

    // Basic Info
    lib.log.section('Stream Information');
    console.log(`  Name:           ${desc.DeliveryStreamName}`);
    console.log(`  ARN:            ${desc.DeliveryStreamARN}`);
    console.log(`  Status:         ${desc.DeliveryStreamStatus}`);
    console.log(`  Type:           ${desc.DeliveryStreamType}`);
    console.log(`  Created:        ${lib.formatDate(desc.CreateTimestamp)}`);

    // Destination
    lib.log.section('Destination Configuration');
    const dest = desc.Destinations?.[0];
    if (dest) {
      if (dest.S3DestinationDescription) {
        const s3 = dest.S3DestinationDescription;
        console.log(`  Type:           S3`);
        console.log(`  Bucket:         ${s3.BucketARN}`);
        console.log(`  Prefix:         ${s3.Prefix || '(none)'}`);
        console.log(`  Compression:    ${s3.CompressionFormat}`);
        console.log(`  Buffer Size:    ${s3.BufferingHints?.SizeInMBs} MB`);
        console.log(`  Buffer Time:    ${s3.BufferingHints?.IntervalInSeconds} seconds`);
      } else if (dest.ExtendedS3DestinationDescription) {
        const s3 = dest.ExtendedS3DestinationDescription;
        console.log(`  Type:           Extended S3`);
        console.log(`  Bucket:         ${s3.BucketARN}`);
        console.log(`  Prefix:         ${s3.Prefix || '(none)'}`);
        console.log(`  Compression:    ${s3.CompressionFormat}`);
        console.log(`  Buffer Size:    ${s3.BufferingHints?.SizeInMBs} MB`);
        console.log(`  Buffer Time:    ${s3.BufferingHints?.IntervalInSeconds} seconds`);
      }
    }

    // Source
    if (desc.Source?.KinesisStreamSourceDescription) {
      lib.log.section('Source Configuration');
      const src = desc.Source.KinesisStreamSourceDescription;
      console.log(`  Type:           Kinesis Stream`);
      console.log(`  Stream ARN:     ${src.KinesisStreamARN}`);
    }

    // Usage hints
    console.log('');
    lib.log.info('Useful commands:');
    lib.log.info(`  Test:    node firehose-manage.js test ${streamName}`);
    lib.log.info(`  Status:  node firehose-manage.js status ${streamName}`);
    lib.log.info(`  Delete:  aws firehose delete-delivery-stream --delivery-stream-name ${streamName}`);

    return 0;
  }

  async cmdCreate(streamName?: string, s3Bucket?: string): Promise<number> {
    const prefix = (this.options.prefix as string) || 'logs/';
    const bufferSize = parseInt(this.options.bufferSize as string, 10) || 5;
    const bufferInterval = parseInt(this.options.bufferInterval as string, 10) || 300;

    if (!streamName || !s3Bucket) {
      lib.log.fail('Stream name and S3 bucket are required');
      console.log('');
      console.log('Usage: node firehose-manage.js create <stream-name> <s3-bucket>');
      console.log('');
      console.log('Options:');
      console.log('  --prefix <prefix>           S3 prefix (default: logs/)');
      console.log('  --buffer-size <MB>          Buffer size in MB (default: 5)');
      console.log('  --buffer-interval <sec>     Buffer interval in seconds (default: 300)');
      return 1;
    }

    if (!this.validate(() => this.validateNames([streamName, 'stream'], [s3Bucket, 'bucket'], [prefix, 'prefix']))) {
      return 1;
    }

    lib.log.header(`Create Firehose Stream: ${streamName}`);

    lib.log.info(`Region: ${this.region}`);
    lib.log.info(`Stream Name: ${streamName}`);
    lib.log.info(`S3 Bucket: ${s3Bucket}`);
    lib.log.info(`S3 Prefix: ${prefix}`);
    lib.log.info(`Buffer Size: ${bufferSize} MB`);
    lib.log.info(`Buffer Interval: ${bufferInterval} seconds`);
    console.log('');

    // Check if stream exists
    const existing = this.describeDeliveryStream(streamName);
    if (existing) {
      lib.log.warn(`Stream '${streamName}' already exists`);
      lib.log.info(`Status: ${existing.DeliveryStreamDescription?.DeliveryStreamStatus}`);
      return 0;
    }

    // Check if S3 bucket exists
    if (!lib.s3BucketExists(s3Bucket)) {
      lib.log.fail(`S3 bucket '${s3Bucket}' not found`);
      return 1;
    }

    // Get AWS account ID for IAM role
    const accountId = lib.awsGetAccountId();
    if (!accountId) {
      lib.log.fail('Failed to get AWS account ID');
      return 1;
    }

    // Create IAM role for Firehose
    lib.log.section('Creating IAM Role');
    const roleName = `firehose-${streamName}-role`;
    const roleArn = await this.createFirehoseRole(roleName, s3Bucket, accountId);
    if (!roleArn) {
      lib.log.fail('Failed to create IAM role');
      return 1;
    }
    lib.log.pass(`IAM Role created: ${roleName}`);

    // Wait for role propagation
    lib.log.info('Waiting for IAM role propagation (10 seconds)...');
    await lib.sleep(10000);

    // Create delivery stream
    lib.log.section('Creating Delivery Stream');

    const config = {
      DeliveryStreamName: streamName,
      DeliveryStreamType: 'DirectPut',
      ExtendedS3DestinationConfiguration: {
        BucketARN: `arn:aws:s3:::${s3Bucket}`,
        RoleARN: roleArn,
        Prefix: prefix,
        BufferingHints: {
          SizeInMBs: bufferSize,
          IntervalInSeconds: bufferInterval,
        },
        CompressionFormat: 'GZIP',
      },
    };

    try {
      lib.run(
        `aws firehose create-delivery-stream --cli-input-json '${JSON.stringify(config)}' --region ${this.region}`,
        { silent: true }
      );
      lib.log.pass('Delivery stream created');
    } catch (error: unknown) {
      lib.log.fail(`Failed to create stream: ${toError(error).message}`);
      return 1;
    }

    // Wait for stream to become active
    lib.log.section('Waiting for Stream to Become Active');
    const isActive = await this.waitForStreamActive(streamName);
    if (!isActive) {
      lib.log.warn('Stream creation in progress. Check status later.');
    } else {
      lib.log.pass('Stream is ACTIVE');
    }

    // Summary
    console.log('');
    lib.log.pass('Firehose stream creation completed!');
    console.log('');
    lib.log.info('Useful commands:');
    lib.log.info(`  Show:    node firehose-manage.js show ${streamName}`);
    lib.log.info(`  Test:    node firehose-manage.js test ${streamName}`);
    lib.log.info(`  Delete:  aws firehose delete-delivery-stream --delivery-stream-name ${streamName}`);

    return 0;
  }

  async cmdDelete(streamName?: string): Promise<number> {
    if (!streamName) {
      lib.log.fail('Stream name is required');
      console.log('');
      console.log('Usage: node firehose-manage.js delete <stream-name>');
      return 1;
    }

    if (!this.validate(() => this.validateName(streamName, 'stream'))) {
      return 1;
    }

    lib.log.header(`Delete Firehose Stream: ${streamName}`);

    lib.log.info(`Region: ${this.region}`);
    lib.log.info(`Stream Name: ${streamName}`);
    console.log('');

    // Check if stream exists
    const details = this.describeDeliveryStream(streamName);
    if (!details) {
      lib.log.fail(`Stream '${streamName}' not found`);
      return 1;
    }

    const status = details.DeliveryStreamDescription?.DeliveryStreamStatus;
    lib.log.info(`Current Status: ${status}`);

    if (status === 'DELETING') {
      lib.log.warn('Stream is already being deleted');
      return 0;
    }

    // Confirm deletion
    if (!this.options.force) {
      lib.log.warn('This will permanently delete the delivery stream!');
      if (!await lib.confirm('Are you sure you want to delete this stream?')) {
        lib.log.info('Cancelled');
        return 0;
      }
    }

    // Delete the stream
    lib.log.section('Deleting Stream');

    try {
      lib.run(
        `aws firehose delete-delivery-stream --delivery-stream-name ${streamName} --region ${this.region}`,
        { ignoreError: false }
      );
      lib.log.pass(`Deletion initiated for stream '${streamName}'`);
      lib.log.info('Note: Stream deletion is asynchronous. Use "status" command to check progress.');
      return 0;
    } catch (error: unknown) {
      const err = toError(error);
      if (err.message?.includes('ResourceNotFoundException')) {
        lib.log.fail(`Stream '${streamName}' not found`);
      } else {
        lib.log.fail(`Failed to delete stream: ${err.message}`);
      }
      return 1;
    }
  }

  async cmdStatus(streamName?: string): Promise<number> {
    if (!streamName) {
      lib.log.fail('Stream name is required');
      console.log('');
      console.log('Usage: node firehose-manage.js status <stream-name>');
      return 1;
    }

    if (!this.validate(() => this.validateName(streamName, 'stream'))) {
      return 1;
    }

    lib.log.header(`Firehose Status: ${streamName}`);

    const details = this.describeDeliveryStream(streamName);
    if (!details) {
      lib.log.fail(`Stream '${streamName}' not found`);
      return 1;
    }

    const desc = details.DeliveryStreamDescription;
    const status = desc.DeliveryStreamStatus;

    console.log('');
    console.log(`  Stream:   ${streamName}`);
    console.log(`  Status:   ${status}`);
    console.log(`  Type:     ${desc.DeliveryStreamType}`);
    console.log('');

    if (status === 'ACTIVE') {
      lib.log.pass('Stream is healthy and accepting data');
    } else if (status === 'CREATING') {
      lib.log.warn('Stream is being created...');
    } else if (status === 'DELETING') {
      lib.log.warn('Stream is being deleted...');
    } else {
      lib.log.fail(`Stream status: ${status}`);
    }

    return status === 'ACTIVE' ? 0 : 1;
  }

  async cmdTest(streamName?: string): Promise<number> {
    if (!streamName) {
      lib.log.fail('Stream name is required');
      console.log('');
      console.log('Usage: node firehose-manage.js test <stream-name>');
      return 1;
    }

    if (!this.validate(() => this.validateName(streamName, 'stream'))) {
      return 1;
    }

    lib.log.header(`Test Firehose Stream: ${streamName}`);

    // Check stream exists and is active
    const details = this.describeDeliveryStream(streamName);
    if (!details) {
      lib.log.fail(`Stream '${streamName}' not found`);
      return 1;
    }

    const status = details.DeliveryStreamDescription?.DeliveryStreamStatus;
    if (status !== 'ACTIVE') {
      lib.log.fail(`Stream is not active. Current status: ${status}`);
      return 1;
    }

    lib.log.info(`Stream: ${streamName}`);
    lib.log.info(`Status: ${status}`);
    console.log('');

    // Send test record
    lib.log.section('Sending Test Record');

    const testRecord = {
      timestamp: new Date().toISOString(),
      type: 'test',
      message: 'Hello from firehose-manage.js',
      source: 'firehose-manage-test',
    };

    const recordData = Buffer.from(JSON.stringify(testRecord) + '\n').toString('base64');

    try {
      const result = lib.run(
        `aws firehose put-record --delivery-stream-name ${streamName} --record '{"Data":"${recordData}"}' --region ${this.region} --output json`,
        { ignoreError: true }
      );

      if (!result) {
        lib.log.fail('Failed to send test record');
        return 1;
      }

      const response = JSON.parse(result);
      if (response.RecordId) {
        lib.log.pass('Test record sent successfully');
        console.log('');
        console.log(`  Record ID: ${response.RecordId}`);
        console.log(`  Data:      ${JSON.stringify(testRecord)}`);
        console.log('');
        lib.log.info('Note: Data will appear in S3 after buffer interval (default: 5 minutes)');
        return 0;
      } else {
        lib.log.fail('Failed to send test record');
        return 1;
      }
    } catch (error: unknown) {
      lib.log.fail(`Failed to send test record: ${toError(error).message}`);
      return 1;
    }
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  listDeliveryStreams(): string[] {
    const result = lib.run(
      `aws firehose list-delivery-streams --region ${this.region} --output json`,
      { ignoreError: true }
    );
    if (!result) return [];
    try {
      const data = JSON.parse(result);
      return data.DeliveryStreamNames || [];
    } catch {
      return [];
    }
  }

  describeDeliveryStream(streamName: string): DeliveryStreamDetails | null {
    const result = lib.run(
      `aws firehose describe-delivery-stream --delivery-stream-name ${streamName} --region ${this.region} --output json`,
      { ignoreError: true }
    );
    if (!result) return null;
    try {
      return JSON.parse(result);
    } catch {
      return null;
    }
  }

  getDestinationType(details: DeliveryStreamDetails | null): string {
    const dest = details?.DeliveryStreamDescription?.Destinations?.[0];
    if (!dest) return 'Unknown';
    if (dest.S3DestinationDescription) return 'S3';
    if (dest.ExtendedS3DestinationDescription) return 'Extended S3';
    if (dest.RedshiftDestinationDescription) return 'Redshift';
    if (dest.ElasticsearchDestinationDescription) return 'Elasticsearch';
    if (dest.SplunkDestinationDescription) return 'Splunk';
    if (dest.HttpEndpointDestinationDescription) return 'HTTP';
    return 'Unknown';
  }

  async createFirehoseRole(roleName: string, s3Bucket: string, accountId: string): Promise<string | null> {
    const trustPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'firehose.amazonaws.com' },
          Action: 'sts:AssumeRole',
        },
      ],
    };

    const s3Policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Action: ['s3:PutObject', 's3:GetBucketLocation', 's3:ListBucket'],
          Resource: [`arn:aws:s3:::${s3Bucket}`, `arn:aws:s3:::${s3Bucket}/*`],
        },
      ],
    };

    try {
      // Create role
      lib.run(
        `aws iam create-role --role-name ${roleName} --assume-role-policy-document '${JSON.stringify(trustPolicy)}'`,
        { silent: true }
      );

      // Attach inline policy
      lib.run(
        `aws iam put-role-policy --role-name ${roleName} --policy-name ${roleName}-s3-policy --policy-document '${JSON.stringify(s3Policy)}'`,
        { silent: true }
      );

      return `arn:aws:iam::${accountId}:role/${roleName}`;
    } catch {
      // Role might already exist
      const result = lib.run(`aws iam get-role --role-name ${roleName} --output json`, {
        ignoreError: true,
      });
      if (!result) return null;
      try {
        const role = JSON.parse(result);
        return role.Role?.Arn;
      } catch {
        return null;
      }
    }
  }

  async waitForStreamActive(streamName: string, maxWait = 120): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWait * 1000) {
      const details = this.describeDeliveryStream(streamName);
      const status = details?.DeliveryStreamDescription?.DeliveryStreamStatus;
      if (status === 'ACTIVE') return true;
      if (status !== 'CREATING') return false;
      process.stdout.write('.');
      await lib.sleep(5000);
    }
    console.log('');
    return false;
  }
}

FirehoseManage.main();
