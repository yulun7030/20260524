// ════════════════════════════════════════════════════════════════
// useEarthquake.js - 地震資料 Composable
//
// 資料來源：中央氣象署（CWA）開放資料平台
// 申請網址：https://opendata.cwa.gov.tw → 會員中心 → 取得授權碼
//
// 使用的 API：
//   E-A0015-001  顯著有感地震報告（規模較大、較完整）
//   E-A0016-001  小區域有感地震報告（規模較小）
// ════════════════════════════════════════════════════════════════

import { ref, computed } from 'vue'

// ── 震度等級定義 ───────────────────────────────────────────────
export const INTENSITY_LEVELS = [
  { value: '0', label: '0 級',   color: '#94a3b8', bg: 'rgba(148,163,184,.15)', desc: '無感' },
  { value: '1', label: '1 級',   color: '#22c55e', bg: 'rgba(34,197,94,.15)',   desc: '微震' },
  { value: '2', label: '2 級',   color: '#84cc16', bg: 'rgba(132,204,22,.15)',  desc: '輕震' },
  { value: '3', label: '3 級',   color: '#eab308', bg: 'rgba(234,179,8,.15)',   desc: '弱震' },
  { value: '4', label: '4 級',   color: '#f97316', bg: 'rgba(249,115,22,.15)',  desc: '中震' },
  { value: '5弱', label: '5弱級', color: '#ef4444', bg: 'rgba(239,68,68,.15)',   desc: '強震' },
  { value: '5強', label: '5強級', color: '#dc2626', bg: 'rgba(220,38,38,.15)',   desc: '強震' },
  { value: '6弱', label: '6弱級', color: '#b91c1c', bg: 'rgba(185,28,28,.15)',   desc: '烈震' },
  { value: '6強', label: '6強級', color: '#7f1d1d', bg: 'rgba(127,29,29,.15)',   desc: '烈震' },
  { value: '7', label: '7 級',   color: '#450a0a', bg: 'rgba(69,10,10,.15)',    desc: '劇震' },
]

// 依震度字串取得等級物件
export function getIntensityLevel(intensity) {
  return INTENSITY_LEVELS.find(l => l.value === String(intensity))
    ?? INTENSITY_LEVELS[0]
}

// ── 規模 → 地圖標記半徑 ────────────────────────────────────────
export function magnitudeToRadius(mag) {
  const m = parseFloat(mag) || 0
  // 規模每增加 1，面積大約增加 10 倍，用 exp 模擬視覺效果
  return Math.max(8, Math.min(60, Math.pow(m, 2.2) * 1.5))
}

// ── 規模 → 顏色 ────────────────────────────────────────────────
export function magnitudeToColor(mag) {
  const m = parseFloat(mag) || 0
  if (m >= 6.0) return '#ef4444'   // 強震：紅色
  if (m >= 5.0) return '#f97316'   // 中強震：橘色
  if (m >= 4.0) return '#eab308'   // 中震：黃色
  if (m >= 3.0) return '#22c55e'   // 小震：綠色
  return '#94a3b8'                  // 微震：灰色
}

// ── 格式化日期時間 ─────────────────────────────────────────────
export function formatDateTime(str) {
  if (!str) return '—'
  try {
    const d = new Date(str)
    return d.toLocaleString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    })
  } catch { return str }
}

// 計算距離現在多久
export function timeAgo(str) {
  if (!str) return ''
  try {
    const diff  = Date.now() - new Date(str).getTime()
    const mins  = Math.floor(diff / 60000)
    const hours = Math.floor(mins / 60)
    const days  = Math.floor(hours / 24)
    if (days > 0)  return `${days} 天前`
    if (hours > 0) return `${hours} 小時前`
    if (mins > 0)  return `${mins} 分鐘前`
    return '剛才'
  } catch { return '' }
}

// ── 主要 Composable ────────────────────────────────────────────
export function useEarthquake() {
  const significant = ref([])   // 顯著有感地震
  const small       = ref([])   // 小區域地震
  const isLoading   = ref(false)
  const error       = ref(null)
  const lastUpdate  = ref('')
  const apiKey      = ref('')    // CWA API 授權碼

  // 所有地震合併（顯著 + 小區域），依時間排序
  const allQuakes = computed(() => {
    const combined = [...significant.value, ...small.value]
    return combined.sort((a, b) =>
      new Date(b.time) - new Date(a.time)
    )
  })

  // 統計資訊
  const stats = computed(() => {
    const list = allQuakes.value
    return {
      total:     list.length,
      maxMag:    list.reduce((m, q) => Math.max(m, q.magnitude), 0),
      avgMag:    list.length
        ? (list.reduce((s, q) => s + q.magnitude, 0) / list.length).toFixed(1)
        : 0,
      strong:    list.filter(q => q.magnitude >= 5).length,
      today:     list.filter(q => {
        const d = new Date(q.time)
        const now = new Date()
        return d.toDateString() === now.toDateString()
      }).length
    }
  })

  // ── 整理單筆地震資料 ──────────────────────────────────────────
  function parseQuake(eq) {
    const info      = eq.EarthquakeInfo ?? {}
    const epicenter = info.Epicenter ?? {}
    const magInfo   = info.EarthquakeMagnitude ?? {}
    const intensity = eq.Intensity ?? {}

    // 取最大震度（ShakingArea 第一筆通常是最大震度）
    const maxArea = (intensity.ShakingArea ?? [])[0] ?? {}

    // 整理各縣市震度
    const areaIntensities = (intensity.ShakingArea ?? []).map(area => ({
      county:    area.CountyName,
      intensity: area.AreaIntensity,
      level:     getIntensityLevel(area.AreaIntensity)
    }))

    return {
      no:          eq.EarthquakeNo,
      type:        eq.ReportType,
      color:       eq.ReportColor,
      time:        info.OriginTime,
      source:      info.Source,
      depth:       info.FocalDepth,
      location:    epicenter.Location,
      lat:         parseFloat(epicenter.EpicenterLatitude)  || 0,
      lng:         parseFloat(epicenter.EpicenterLongitude) || 0,
      magnitude:   parseFloat(magInfo.MagnitudeValue)       || 0,
      magType:     magInfo.MagnitudeType,
      maxIntensity: maxArea.AreaIntensity,
      maxArea:     maxArea.AreaDesc,
      areaIntensities,
      imageUrl:    eq.ReportImageURI,
      webUrl:      eq.Web,
      content:     eq.ReportContent,
      magColor:    magnitudeToColor(magInfo.MagnitudeValue),
      radius:      magnitudeToRadius(magInfo.MagnitudeValue)
    }
  }

  // ── 呼叫 CWA API ──────────────────────────────────────────────
  async function fetchDataset(datasetId, limit = 20) {
    if (!apiKey.value.trim()) {
      throw new Error('請先填入中央氣象署 API Key（點右上角「🔑 設定」）')
    }

    const url = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore/' + datasetId
      + '?Authorization=' + encodeURIComponent(apiKey.value.trim())
      + '&format=JSON'
      + '&limit=' + limit

    const res = await fetch(url)
    if (!res.ok) throw new Error(`API 回應 HTTP ${res.status}`)

    const json = await res.json()
    if (json.success !== 'true') throw new Error('API 回傳失敗：' + JSON.stringify(json))

    return json.records?.Earthquake ?? []
  }

  // ── 載入所有地震資料 ──────────────────────────────────────────
  async function load() {
    if (!apiKey.value.trim()) {
      error.value = '請先填入中央氣象署 API Key（點右上角「🔑 設定」）'
      return
    }

    isLoading.value = true
    error.value     = null

    try {
      // 同時載入「顯著有感」和「小區域有感」
      const [sigData, smlData] = await Promise.allSettled([
        fetchDataset('E-A0015-001', 20),
        fetchDataset('E-A0016-001', 20)
      ])

      if (sigData.status === 'fulfilled') {
        significant.value = sigData.value.map(parseQuake)
      }
      if (smlData.status === 'fulfilled') {
        small.value = smlData.value.map(parseQuake)
      }

      // 如果兩個都失敗
      if (sigData.status === 'rejected' && smlData.status === 'rejected') {
        throw sigData.reason
      }

      lastUpdate.value = new Date().toLocaleTimeString('zh-TW')

    } catch (err) {
      error.value = err.message
      console.error('[useEarthquake]', err)
    } finally {
      isLoading.value = false
    }
  }

  return {
    significant, small, allQuakes,
    isLoading, error, lastUpdate,
    apiKey, stats, load
  }
}
