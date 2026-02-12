// Base class
export { BaseLogService } from './BaseLogService.js'

// Access logs (Firehose → S3, Console)
export { ConsoleLogService, FirehoseService } from './Access/index.js'

// Error logs (CloudWatch)
export { CloudWatchErrorLogService, NullErrorLogService } from './Error/index.js'
