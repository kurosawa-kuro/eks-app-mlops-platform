// =============================================================================
// Lambda Handler for Auth Service
// =============================================================================
// Hono AWS Lambda Adapter を使用して ALB/API Gateway からのイベントを処理
//
// 使用方法:
//   Lambda Runtime: nodejs20.x
//   Handler: src/lambda-handler.handler
// =============================================================================
import 'dotenv/config';
import { handle } from 'hono/aws-lambda';
import app from './app.js';
/**
 * AWS Lambda handler
 * ALB/API Gateway v1/v2 からのイベントを Hono が処理できる形式に変換
 */
export const handler = handle(app);
