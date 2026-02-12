/**
 * リクエストID生成ユーティリティ
 *
 * リクエストトレーシングのための一意識別子を生成
 */

/**
 * リクエストID生成
 *
 * 形式: req_{timestamp}_{random}
 * 例: req_m4x5y6z_abc1234
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}
