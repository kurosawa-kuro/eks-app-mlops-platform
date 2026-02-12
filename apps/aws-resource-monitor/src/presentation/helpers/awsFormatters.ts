/**
 * AWS Presentation Layer Formatters
 * AWS Resource Monitor用の共通フォーマット処理
 */

import type { ResourceType } from '../../domain/entities/resource.js'

// ============================================================================
// Date/Time Formatters
// ============================================================================

/**
 * ResourceServiceのlastUpdatedMapから最初の有効な日時を取得しフォーマット
 * @param lastUpdatedMap ResourceService.getLastUpdated()の戻り値
 * @returns フォーマットされた時刻文字列 または null
 */
export function formatLastUpdated(
  lastUpdatedMap: Map<ResourceType, Date | null>
): string | null {
  for (const date of lastUpdatedMap.values()) {
    if (date) {
      return date.toLocaleTimeString('ja-JP')
    }
  }
  return null
}

/**
 * 日付をYYYY-MM-DD HH:mm形式でフォーマット
 * @param date 日付
 * @returns フォーマットされた日時文字列
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '-'
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// ============================================================================
// Status Helpers
// ============================================================================

/**
 * リソース状態に対応するCSSクラスを取得
 * @param state リソースの状態
 * @returns CSSクラス名
 */
export function getStatusClass(state: string | null | undefined): string {
  if (!state) return 'status-inactive'

  const s = state.toLowerCase()

  // 正常状態
  if (['running', 'available', 'active', 'in-use', 'in_use', 'attached', 'valid', 'enabled'].includes(s)) {
    return 'status-ok'
  }

  // 処理中状態
  if (['pending', 'creating', 'modifying', 'updating'].includes(s)) {
    return 'status-pending'
  }

  // 警告状態
  if (['stopping', 'deleting', 'shutting-down'].includes(s)) {
    return 'status-warning'
  }

  // エラー状態
  if (['failed', 'error', 'terminated', 'deleted'].includes(s)) {
    return 'status-error'
  }

  return 'status-inactive'
}

/**
 * 状態を表示用ラベルに変換
 * @param state リソースの状態
 * @returns 表示用ラベル
 */
export function getStatusLabel(state: string | null | undefined): string {
  if (!state) return 'Unknown'
  return state.charAt(0).toUpperCase() + state.slice(1).toLowerCase()
}

// ============================================================================
// Cost Helpers
// ============================================================================

/**
 * 高コストリソースのCSSクラスを取得
 * @param type リソースタイプ
 * @param criticalTypes S級リソースタイプ配列
 * @param warningTypes A級リソースタイプ配列
 * @returns CSSクラス名
 */
export function getCostClass(
  type: ResourceType,
  criticalTypes: ResourceType[],
  warningTypes: ResourceType[]
): string {
  if (criticalTypes.includes(type)) return 'cost-critical'
  if (warningTypes.includes(type)) return 'cost-warning'
  return ''
}

/**
 * 高コストリソースのバッジHTMLを取得
 * @param type リソースタイプ
 * @param criticalTypes S級リソースタイプ配列
 * @param warningTypes A級リソースタイプ配列
 * @returns バッジHTML
 */
export function getCostBadge(
  type: ResourceType,
  criticalTypes: ResourceType[],
  warningTypes: ResourceType[]
): string {
  if (criticalTypes.includes(type)) return '<span class="cost-badge critical">S</span>'
  if (warningTypes.includes(type)) return '<span class="cost-badge warning">A</span>'
  return ''
}
