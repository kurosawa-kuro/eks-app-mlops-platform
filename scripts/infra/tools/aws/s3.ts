#!/usr/bin/env npx tsx
/**
 * S3 Management Script
 * Manage Amazon S3 buckets: list, show, create
 */

import * as fs from 'fs';
import { AwsCommand, lib } from '../../framework/command/AwsCommand.js';
import { toError } from '../../infrastructure/types.js';
import type { CommandDefinition, OptionDefinition } from '../../framework/types.js';

class S3Manage extends AwsCommand {
  static override name = 's3-manage';
  static service = 's3';
  static override description = 'S3 Management Script';

  static override commands: Record<string, CommandDefinition> = {
    list: { desc: 'List all S3 buckets', aliases: ['ls'], requireAws: true },
    show: { desc: 'Show bucket details and objects', args: '<bucket-name>', aliases: ['info'], requireAws: true },
    create: { desc: 'Create a new S3 bucket', args: '<bucket-name>', aliases: ['new'], requireAws: true },
    delete: { desc: 'Delete an S3 bucket', args: '<bucket-name>', aliases: ['rm'], requireAws: true },
    setup: { desc: 'Create bucket with sample files', args: '<bucket-name>', requireAws: true },
    upload: { desc: 'Upload a file to S3', args: '<bucket> <key> <file>', aliases: ['put', 'cp'], requireAws: true },
  };

  static override options: Record<string, OptionDefinition> = {
    '--env': { name: 'env', type: 'string', desc: 'Environment tag (default: dev)' },
    '--limit': { name: 'limit', type: 'string', desc: 'Limit objects shown (default: 20)' },
    '--force': { name: 'force', type: 'boolean', desc: 'Force delete (skip confirmation, delete all objects)' },
  };

  // ============================================================
  // Commands
  // ============================================================

  async cmdList(): Promise<number> {
    lib.log.header('S3 Buckets');
    lib.log.info(`Region: ${this.region}`);
    console.log('');

    const result = lib.s3ListBuckets();
    const buckets = result.Buckets || [];

    if (buckets.length === 0) {
      lib.log.info('No buckets found');
      return 0;
    }

    lib.log.pass(`Found ${buckets.length} bucket(s)`);
    console.log('');

    const rows = buckets.map((bucket) => [
      bucket.Name || '',
      lib.formatDate(bucket.CreationDate),
    ]);
    this.formatTable(['BUCKET NAME', 'CREATED'], rows, [40, 20]);

    return 0;
  }

  async cmdShow(bucketName?: string): Promise<number> {
    const limit = parseInt(this.options.limit as string, 10) || 20;

    if (!bucketName) {
      lib.log.fail('Bucket name is required');
      console.log('');
      console.log('Usage: node s3-manage.js show <bucket-name>');
      return 1;
    }

    if (!this.validate(() => this.validateName(bucketName, 'bucket'))) {
      return 1;
    }

    lib.log.header(`S3 Bucket: ${bucketName}`);

    // Check if bucket exists
    if (!lib.s3BucketExists(bucketName)) {
      lib.log.fail(`Bucket '${bucketName}' not found`);
      return 1;
    }

    // Get bucket info
    lib.log.section('Bucket Information');
    const info = lib.s3GetBucketInfo(bucketName);

    console.log(`  Name:           ${info.name}`);
    console.log(`  Region:         ${info.region}`);
    console.log(`  Versioning:     ${info.versioning}`);
    console.log(`  Encryption:     ${info.encryption}`);

    // Get bucket size
    lib.log.section('Bucket Size');

    const statsResult = lib.run(`aws s3 ls s3://${bucketName} --recursive --summarize`, {
      ignoreError: true,
    });

    if (statsResult) {
      const lines = statsResult.split('\n');
      const totalObjects = lines.find((l) => l.includes('Total Objects'))?.match(/\d+/)?.[0] || '0';
      const totalSize = lines.find((l) => l.includes('Total Size'))?.match(/\d+/)?.[0] || '0';

      console.log(`  Total Objects:  ${totalObjects}`);
      console.log(`  Total Size:     ${lib.formatBytes(parseInt(totalSize, 10))}`);
    } else {
      lib.log.info('Bucket is empty or could not determine size');
    }

    // List objects
    lib.log.section(`Objects (up to ${limit})`);

    const objects = lib.s3ListObjects(bucketName, '', limit);

    if (objects.length === 0) {
      lib.log.info('No objects found');
    } else {
      lib.log.pass(`Showing ${objects.length} object(s)`);
      console.log('');

      console.log('  ' + 'DATE'.padEnd(12) + 'SIZE'.padEnd(10) + 'KEY');
      console.log('  ' + '----'.padEnd(12) + '----'.padEnd(10) + '---');

      for (const line of objects) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          const date = parts[0];
          const size = parseInt(parts[2], 10) || 0;
          const key = parts.slice(3).join(' ');
          console.log('  ' + date.padEnd(12) + lib.formatBytes(size).padEnd(10) + key);
        }
      }
    }

    // Usage hints
    console.log('');
    lib.log.info('Useful commands:');
    lib.log.info(`  List all:   aws s3 ls s3://${bucketName} --recursive`);
    lib.log.info(`  Download:   aws s3 cp s3://${bucketName}/path/file.txt .`);
    lib.log.info(`  Upload:     aws s3 cp file.txt s3://${bucketName}/`);
    lib.log.info(`  Delete:     aws s3 rb s3://${bucketName} --force`);

    return 0;
  }

  async cmdCreate(bucketName?: string): Promise<number> {
    if (!bucketName) {
      lib.log.fail('Bucket name is required');
      console.log('');
      console.log('Usage: node s3-manage.js create <bucket-name>');
      return 1;
    }

    if (!this.validate(() => this.validateName(bucketName, 'bucket'))) {
      return 1;
    }

    lib.log.header(`Create S3 Bucket: ${bucketName}`);
    lib.log.info(`Region: ${this.region}`);
    lib.log.info(`Bucket Name: ${bucketName}`);
    console.log('');

    // Check if exists
    if (lib.s3BucketExists(bucketName)) {
      lib.log.warn(`Bucket '${bucketName}' already exists`);
      return 0;
    }

    // Create bucket
    lib.log.section('Creating Bucket');

    if (!lib.s3CreateBucket(bucketName, this.region)) {
      lib.log.fail('Failed to create bucket');
      return 1;
    }
    lib.log.pass('Bucket created');

    // Configure bucket
    lib.log.section('Configuring Bucket');

    if (lib.s3BlockPublicAccess(bucketName)) {
      lib.log.pass('Public access blocked');
    } else {
      lib.log.warn('Failed to block public access');
    }

    if (lib.s3EnableVersioning(bucketName)) {
      lib.log.pass('Versioning enabled');
    } else {
      lib.log.warn('Failed to enable versioning');
    }

    // Summary
    console.log('');
    lib.log.pass('Bucket creation completed!');
    console.log('');
    lib.log.info('Useful commands:');
    lib.log.info(`  Show:     node s3-manage.js show ${bucketName}`);
    lib.log.info(`  Upload:   aws s3 cp file.txt s3://${bucketName}/`);
    lib.log.info(`  Delete:   aws s3 rb s3://${bucketName} --force`);

    return 0;
  }

  async cmdDelete(bucketName?: string): Promise<number> {
    if (!bucketName) {
      lib.log.fail('Bucket name is required');
      console.log('');
      console.log('Usage: node s3-manage.js delete <bucket-name>');
      console.log('');
      console.log('Options:');
      console.log('  --force    Force delete (skip confirmation, delete all objects)');
      return 1;
    }

    if (!this.validate(() => this.validateName(bucketName, 'bucket'))) {
      return 1;
    }

    lib.log.header(`Delete S3 Bucket: ${bucketName}`);

    lib.log.info(`Region: ${this.region}`);
    lib.log.info(`Bucket Name: ${bucketName}`);
    console.log('');

    // Check if bucket exists
    if (!lib.s3BucketExists(bucketName)) {
      lib.log.fail(`Bucket '${bucketName}' not found`);
      return 1;
    }

    // Get object count
    const statsResult = lib.run(`aws s3 ls s3://${bucketName} --recursive --summarize`, {
      ignoreError: true,
    });

    let objectCount = 0;
    if (statsResult) {
      const match = statsResult.match(/Total Objects:\s*(\d+)/);
      objectCount = match ? parseInt(match[1], 10) : 0;
    }

    lib.log.info(`Objects in bucket: ${objectCount}`);

    if (objectCount > 0 && !this.options.force) {
      lib.log.warn('Bucket is not empty. Use --force to delete with all objects.');
      return 1;
    }

    // Confirm deletion
    if (!this.options.force) {
      lib.log.warn('This will permanently delete the bucket!');
      if (!await lib.confirm('Are you sure you want to delete this bucket?')) {
        lib.log.info('Cancelled');
        return 0;
      }
    }

    // Delete all objects first if bucket is not empty
    if (objectCount > 0) {
      lib.log.section('Deleting All Objects');
      try {
        lib.run(`aws s3 rm s3://${bucketName} --recursive`, { ignoreError: false });
        lib.log.pass('All objects deleted');
      } catch (error: unknown) {
        lib.log.fail(`Failed to delete objects: ${toError(error).message}`);
        return 1;
      }
    }

    // Delete the bucket
    lib.log.section('Deleting Bucket');

    try {
      lib.run(`aws s3 rb s3://${bucketName}`, { ignoreError: false });
      lib.log.pass(`Bucket '${bucketName}' deleted successfully`);
      return 0;
    } catch (error: unknown) {
      const err = toError(error);
      if (err.message?.includes('BucketNotEmpty')) {
        lib.log.fail('Bucket is not empty. Try with --force option.');
      } else {
        lib.log.fail(`Failed to delete bucket: ${err.message}`);
      }
      return 1;
    }
  }

  async cmdSetup(bucketName?: string): Promise<number> {
    const environment = (this.options.env as string) || 'dev';

    if (!bucketName) {
      lib.log.fail('Bucket name is required');
      console.log('');
      console.log('Usage: node s3-manage.js setup <bucket-name>');
      return 1;
    }

    if (!this.validate(() => this.validateName(bucketName, 'bucket'))) {
      return 1;
    }

    lib.log.header(`Setup S3 Bucket: ${bucketName}`);
    lib.log.info(`Region: ${this.region}`);
    lib.log.info(`Bucket Name: ${bucketName}`);
    console.log('');

    let exitCode = 0;

    // Check if exists
    if (lib.s3BucketExists(bucketName)) {
      lib.log.pass(`Bucket '${bucketName}' already exists`);

      // Check for sample files
      const objects = lib.s3ListObjects(bucketName, 'sample/', 10);
      if (objects.length > 0) {
        lib.log.pass('Sample files already exist. Skipping upload.');
      } else {
        lib.log.info('Bucket exists but has no sample files. Uploading...');
        exitCode = await this.uploadSampleFiles(bucketName, environment);
      }
    } else {
      lib.log.info(`Bucket '${bucketName}' does not exist. Creating...`);

      // Create bucket
      if (!lib.s3CreateBucket(bucketName, this.region)) {
        lib.log.fail('Failed to create bucket');
        return 1;
      }
      lib.log.pass('Bucket created');

      // Configure
      if (lib.s3BlockPublicAccess(bucketName)) lib.log.pass('Public access blocked');
      if (lib.s3EnableVersioning(bucketName)) lib.log.pass('Versioning enabled');

      // Upload sample files
      exitCode = await this.uploadSampleFiles(bucketName, environment);
    }

    // Verify
    lib.log.section('Verifying Uploaded Files');
    const objects = lib.s3ListObjects(bucketName, '', 50);

    if (objects.length > 0) {
      lib.log.pass(`Found ${objects.length} file(s) in the bucket`);
      objects.forEach((line) => console.log(`  ${line}`));
    } else {
      lib.log.fail('No files found in the bucket');
      exitCode = 1;
    }

    // Summary
    console.log('');
    if (exitCode === 0) {
      lib.log.pass('Setup complete! All operations completed successfully.');
    } else {
      lib.log.warn('Setup completed with warnings. Some operations failed.');
    }

    console.log('');
    lib.log.info('Useful commands:');
    lib.log.info(`  List files: aws s3 ls s3://${bucketName}/ --recursive`);
    lib.log.info(`  Get file:   aws s3 cp s3://${bucketName}/sample/hello.txt -`);
    lib.log.info(`  Delete:     aws s3 rb s3://${bucketName} --force`);

    return exitCode;
  }

  async uploadSampleFiles(bucketName: string, environment: string): Promise<number> {
    lib.log.section('Uploading Sample Files');

    const timestamp = new Date().toISOString();

    // Hello text file
    const helloContent = `Hello from S3!
This is a sample file for PoC testing.
Created at: ${timestamp}
Bucket: ${bucketName}
Environment: ${environment}`;

    lib.log.info('Uploading sample/hello.txt...');
    if (lib.s3UploadString(bucketName, 'sample/hello.txt', helloContent, 'text/plain')) {
      lib.log.pass('Uploaded sample/hello.txt');
    } else {
      lib.log.fail('Failed to upload sample/hello.txt');
      return 1;
    }

    // JSON config file
    const configContent = JSON.stringify(
      {
        name: 'poc-config',
        version: '1.0.0',
        environment: environment,
        created_at: timestamp,
        settings: { debug: true, log_level: 'info', max_retries: 3 },
        features: { feature_a: true, feature_b: false, feature_c: true },
      },
      null,
      2
    );

    lib.log.info('Uploading sample/config.json...');
    if (lib.s3UploadString(bucketName, 'sample/config.json', configContent, 'application/json')) {
      lib.log.pass('Uploaded sample/config.json');
    } else {
      lib.log.fail('Failed to upload sample/config.json');
      return 1;
    }

    // CSV data file
    const csvContent = `id,name,value,created_at
1,item_a,100,${timestamp}
2,item_b,200,${timestamp}
3,item_c,300,${timestamp}`;

    lib.log.info('Uploading sample/data.csv...');
    if (lib.s3UploadString(bucketName, 'sample/data.csv', csvContent, 'text/csv')) {
      lib.log.pass('Uploaded sample/data.csv');
    } else {
      lib.log.fail('Failed to upload sample/data.csv');
      return 1;
    }

    return 0;
  }

  async cmdUpload(bucketName?: string, key?: string, filePath?: string): Promise<number> {
    if (!bucketName || !key || !filePath) {
      lib.log.fail('Bucket name, key, and file path are required');
      console.log('');
      console.log('Usage: node s3-manage.js upload <bucket> <key> <file>');
      return 1;
    }

    if (!this.validate(() => {
      this.validateName(bucketName, 'bucket');
      this.validateName(key, 'key');
    })) {
      return 1;
    }

    lib.log.header(`Upload to S3: ${bucketName}/${key}`);

    if (!fs.existsSync(filePath)) {
      lib.log.fail(`File not found: ${filePath}`);
      return 1;
    }

    if (!lib.s3BucketExists(bucketName)) {
      lib.log.fail(`Bucket '${bucketName}' not found`);
      return 1;
    }

    const stats = fs.statSync(filePath);
    lib.log.info(`File: ${filePath}`);
    lib.log.info(`Size: ${lib.formatBytes(stats.size)}`);
    lib.log.info(`Destination: s3://${bucketName}/${key}`);
    console.log('');

    lib.log.section('Uploading');

    try {
      lib.run(`aws s3 cp "${filePath}" "s3://${bucketName}/${key}"`);
      lib.log.pass('Upload completed');
      return 0;
    } catch (error: unknown) {
      lib.log.fail(`Upload failed: ${toError(error).message}`);
      return 1;
    }
  }
}

S3Manage.main();
