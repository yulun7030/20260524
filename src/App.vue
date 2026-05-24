<template>
  <div id="app-root">

    <!-- ══ 頂部標題列 ══ -->
    <header class="header">
      <div class="header-left">
        <span class="header-icon">🌊</span>
        <div>
          <div class="header-title">台灣地震速報</div>
          <div class="header-sub">
            資料來源：
            <a href="https://opendata.cwa.gov.tw" target="_blank">中央氣象署開放資料</a>
            ・顯著有感 + 小區域有感地震
          </div>
        </div>
      </div>
      <div class="header-right">
        <span class="update-time" v-if="lastUpdate">🕐 {{ lastUpdate }}</span>
        <button class="key-btn" :class="{ 'has-key': apiKey }"
          @click="showSettings = !showSettings">
          {{ apiKey ? '🔑 已設定' : '🔑 設定 API Key' }}
        </button>
        <button class="refresh-btn" @click="load"
          :disabled="isLoading || !apiKey">
          <span :class="{ spin: isLoading }">🔄</span>
          {{ isLoading ? '載入中...' : '重新整理' }}
        </button>
      </div>
    </header>

    <!-- ══ API Key 設定面板 ══ -->
    <Transition name="slide-down">
      <div class="settings-panel" v-if="showSettings">
        <div class="settings-inner">
          <div class="settings-title">🔑 中央氣象署 API Key 設定</div>
          <div class="settings-hint">
            尚未申請？前往
            <a href="https://opendata.cwa.gov.tw" target="_blank">opendata.cwa.gov.tw</a>
            免費註冊 → 會員中心 → 取得授權碼（格式：CWA-XXXXXXXX-XXXX-...）
          </div>
          <div class="settings-row">
            <input
              class="key-input"
              v-model="apiKey"
              placeholder="CWA-XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              @keyup.enter="handleSaveKey"
            />
            <button class="save-btn" @click="handleSaveKey">💾 套用並載入</button>
            <button class="clear-btn" v-if="apiKey" @click="apiKey = ''">清除</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ══ 主版面 ══ -->
    <div class="main-layout">

      <!-- 左側面板 -->
      <aside class="sidebar">

        <!-- 統計卡片 -->
        <div class="stats-row" v-if="allQuakes.length > 0">
          <div class="stat-card">
            <div class="stat-num red">{{ stats.total }}</div>
            <div class="stat-label">近期地震</div>
          </div>
          <div class="stat-card">
            <div class="stat-num orange" :style="{ color: magnitudeToColor(stats.maxMag) }">
              M{{ stats.maxMag.toFixed(1) }}
            </div>
            <div class="stat-label">最大規模</div>
          </div>
          <div class="stat-card">
            <div class="stat-num yellow">{{ stats.strong }}</div>
            <div class="stat-label">規模 ≥5</div>
          </div>
          <div class="stat-card">
            <div class="stat-num blue">{{ stats.today }}</div>
            <div class="stat-label">今日地震</div>
          </div>
        </div>

        <!-- 篩選標籤 -->
        <div class="filter-tabs" v-if="allQuakes.length > 0">
          <button
            v-for="f in FILTERS"
            :key="f.id"
            class="filter-btn"
            :class="{ active: activeFilter === f.id }"
            @click="activeFilter = f.id"
          >{{ f.label }}</button>
        </div>

        <!-- 狀態訊息 -->
        <div class="status-msg" :class="statusClass">{{ statusText }}</div>

        <!-- 地震列表 -->
        <div class="quake-list">
          <TransitionGroup name="quake-item">
            <div
              v-for="q in filteredQuakes"
              :key="q.no"
              class="quake-card"
              :class="{ selected: selectedNo === q.no }"
              :style="{
                borderLeft: `4px solid ${q.magColor}`,
                background: selectedNo === q.no
                  ? q.magColor.replace(')', ',.08)').replace('rgb', 'rgba')
                  : ''
              }"
              @click="selectQuake(q)"
            >
              <!-- 規模 + 時間 -->
              <div class="quake-top">
                <div class="mag-circle" :style="{
                  background: q.magColor + '22',
                  border: `2px solid ${q.magColor}`,
                  color: q.magColor
                }">
                  <span class="mag-label">M</span>
                  <span class="mag-val">{{ q.magnitude.toFixed(1) }}</span>
                </div>
                <div class="quake-time-info">
                  <div class="quake-time">{{ formatDateTime(q.time) }}</div>
                  <div class="quake-ago">{{ timeAgo(q.time) }}</div>
                </div>
                <div class="quake-type-badge" :class="q.type === '有感地震' ? 'sig' : 'sml'">
                  {{ q.type === '有感地震' ? '顯著' : '小區域' }}
                </div>
              </div>

              <!-- 震央位置 -->
              <div class="quake-location">📍 {{ q.location }}</div>

              <!-- 深度 + 最大震度 -->
              <div class="quake-meta">
                <span>🔽 深度 {{ q.depth }} 公里</span>
                <span v-if="q.maxIntensity">
                  震度
                <strong :style="{
                  backgroundColor: getIntensityLevel(q.maxIntensity).color,
                  color: '#ffffff',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  textShadow: '0 1px 2px rgba(0,0,0,0.4)'
                }">
                    {{ q.maxIntensity }} 級
                  </strong>
                </span>
              </div>

              <!-- 展開詳細資訊 -->
              <Transition name="expand">
                <div v-if="selectedNo === q.no" class="quake-detail">
                  <!-- 各縣市震度 -->
                  <div class="detail-title">各縣市最大震度</div>
                  <div class="intensity-grid">
                    <div
                      v-for="area in q.areaIntensities"
                      :key="area.county"
                      class="intensity-item"
                      :style="{
                        background: area.level.bg,
                        borderColor: area.level.color,
                color: '#ffffff',
                textShadow: '0 1px 2px rgba(0,0,0,0.4)'
                      }"
                    >
                      <span class="area-county">{{ area.county }}</span>
                      <span class="area-intensity">{{ area.intensity }} 級</span>
                    </div>
                  </div>

                  <!-- 地震報告圖 -->
                  <div v-if="q.imageUrl" class="report-image-wrap">
                    <div class="detail-title">地震報告圖</div>
                    <img :src="q.imageUrl" :alt="`地震 ${q.no} 報告圖`"
                      class="report-image"
                      @error="e => e.target.style.display='none'"
                    />
                  </div>

                  <!-- 外部連結 -->
                  <a v-if="q.webUrl" :href="q.webUrl" target="_blank" class="report-link">
                    📄 查看完整地震報告
                  </a>
                </div>
              </Transition>
            </div>
          </TransitionGroup>

          <div class="empty" v-if="!isLoading && allQuakes.length === 0 && apiKey">
            😴 目前查無地震資料
          </div>
          <div class="no-key" v-if="!apiKey">
            <div>🔑</div>
            <div>請先填入中央氣象署 API Key</div>
            <button @click="showSettings = true">前往設定</button>
          </div>
        </div>
      </aside>

      <!-- 右側地圖 -->
      <div ref="mapEl" class="map-area"></div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
import {
  useEarthquake,
  magnitudeToColor, magnitudeToRadius,
  getIntensityLevel, formatDateTime, timeAgo
} from './composables/useEarthquake'

// ── Composable ──
const {
  allQuakes, isLoading, error, lastUpdate,
  apiKey, stats, load
} = useEarthquake()

// ── 本地狀態 ──
const mapEl       = ref(null)
const selectedNo  = ref(null)
const showSettings = ref(false)
const activeFilter = ref('all')

let map     = null
let markers = {}
let circle  = null   // 選取地震的震央圓圈

const FILTERS = [
  { id: 'all',   label: '全部' },
  { id: 'sig',   label: '顯著有感' },
  { id: 'small', label: '小區域' },
  { id: 'strong', label: '規模 ≥ 5' },
]

// ── 篩選後的列表 ──
const filteredQuakes = computed(() => {
  switch (activeFilter.value) {
    case 'sig':   return allQuakes.value.filter(q => q.type === '有感地震')
    case 'small': return allQuakes.value.filter(q => q.type !== '有感地震')
    case 'strong': return allQuakes.value.filter(q => q.magnitude >= 5)
    default:       return allQuakes.value
  }
})

// ── 狀態文字 ──
const statusClass = computed(() => {
  if (isLoading.value) return 'loading'
  if (error.value)     return 'error'
  if (allQuakes.value.length > 0) return 'success'
  return 'default'
})

const statusText = computed(() => {
  if (isLoading.value) return '📡 正在從中央氣象署載入地震資料...'
  if (error.value)     return '❌ ' + error.value
  if (allQuakes.value.length > 0)
    return `✅ 共 ${allQuakes.value.length} 筆地震資料（顯著 + 小區域）`
  return '請設定 API Key 後點擊重新整理'
})

// ── 初始化地圖 ──
function initMap() {
  map = L.map(mapEl.value, {
    center: [23.8, 121.0],
    zoom: 7,
    zoomControl: true
  })

  // 暗色地圖圖層（配合整體深色主題）
  // OpenStreetMap（最穩定，完全免費）
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map)
}

// ── 渲染地震標記 ──
function renderMarkers() {
  Object.values(markers).forEach(m => map.removeLayer(m))
  markers = {}
  if (circle) { map.removeLayer(circle); circle = null }

  allQuakes.value.forEach(q => {
    if (!q.lat || !q.lng) return

    const color  = q.magColor
    const radius = q.radius

    // 圓形標記（大小代表規模）
    const marker = L.circleMarker([q.lat, q.lng], {
      radius,
      fillColor:   color,
      fillOpacity: 0.6,
      color:       color,
      weight:      2,
      opacity:     0.9
    }).addTo(map)

    // 規模文字標記（疊在圓圈上）
    const label = L.divIcon({
      className: '',
      html: `<div style="
        color: white; font-size: 11px; font-weight: 700;
        text-shadow: 0 1px 3px rgba(0,0,0,0.8);
        pointer-events: none; white-space: nowrap;
        font-family: sans-serif;
      ">M${q.magnitude.toFixed(1)}</div>`,
      iconSize: [40, 14],
      iconAnchor: [20, 7]
    })
    L.marker([q.lat, q.lng], { icon: label, interactive: false }).addTo(map)

    marker.bindPopup(`
      <div style="min-width:220px;line-height:1.8">
        <div style="font-size:0.95rem;font-weight:700;margin-bottom:4px">
          🌊 地震 No.${q.no}
        </div>
        <div style="font-size:1.6rem;font-weight:700;color:${color}">
          M ${q.magnitude.toFixed(1)}
        </div>
        <div style="font-size:0.8rem;color:#475569;margin-bottom:8px">
          ${formatDateTime(q.time)} ・ ${timeAgo(q.time)}
        </div>
        <div style="font-size:0.85rem;color:#0f172a;font-weight:600;margin-bottom:4px">
          📍 ${q.location}
        </div>
        <div style="display:flex;gap:16px;font-size:0.8rem;color:#1e293b;font-weight:600;align-items:center">
          <span>🔽 深度 ${q.depth} 公里</span>
          ${q.maxIntensity ? `<span>震度 <strong style="background:${getIntensityLevel(q.maxIntensity).color}; color:#ffffff; padding:2px 6px; border-radius:4px; text-shadow:0 1px 2px rgba(0,0,0,0.4)">${q.maxIntensity} 級</strong></span>` : ''}
        </div>
      </div>
    `, { maxWidth: 280 })

    marker.on('click', () => selectQuake(q))
    markers[q.no] = marker
  })
}

// ── 點選地震 ──
function selectQuake(q) {
  selectedNo.value = q.no

  // 移除舊震央圓圈
  if (circle) { map.removeLayer(circle); circle = null }

  if (!q.lat || !q.lng) return

  // 加入震央圓圈動畫效果
  circle = L.circleMarker([q.lat, q.lng], {
    radius:      q.radius + 12,
    fillColor:   'transparent',
    color:       q.magColor,
    weight:      3,
    opacity:     0.8,
    dashArray:   '6 4'
  }).addTo(map)

  // 地圖飛到震央
  map.flyTo([q.lat, q.lng], 9, { duration: 1.2 })
  markers[q.no]?.openPopup()
}

// ── 儲存 Key 並載入 ──
function handleSaveKey() {
  showSettings.value = false
  if (apiKey.value.trim()) load()
}

// ── 監聽資料更新 ──
watch(allQuakes, () => {
  if (map) renderMarkers()
})

onMounted(() => {
  initMap()
  // 從 localStorage 讀取上次儲存的 Key
  const saved = localStorage.getItem('cwa_api_key')
  if (saved) {
    apiKey.value = saved
    load()
  } else {
    showSettings.value = true   // 沒有 Key 就自動展開設定
  }
})

// 離開前儲存 Key
watch(apiKey, (val) => {
  if (val) localStorage.setItem('cwa_api_key', val)
  else     localStorage.removeItem('cwa_api_key')
})

onUnmounted(() => {
  map?.remove()
})
</script>

<style scoped>
#app-root { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

/* ══ 頂部 ══ */
.header {
  background: #1e293b; border-bottom: 1px solid #334155;
  padding: 12px 20px; display: flex; justify-content: space-between;
  align-items: center; flex-shrink: 0; gap: 12px; flex-wrap: wrap;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header-icon { font-size: 1.8rem; }
.header-title { font-size: 1.05rem; font-weight: 700; color: #f1f5f9; }
.header-sub { font-size: 0.7rem; color: #64748b; margin-top: 2px; }
.header-sub a { color: #3b82f6; text-decoration: none; }
.header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }
.update-time { font-size: 0.72rem; color: #475569; }

.key-btn {
  background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.3);
  border-radius: 8px; padding: 7px 12px; color: #fca5a5; font-size: 0.78rem;
  font-family: 'Noto Sans TC', sans-serif; transition: all 0.2s;
}
.key-btn.has-key { background: rgba(34,197,94,.12); border-color: rgba(34,197,94,.3); color: #86efac; }
.key-btn:hover { opacity: 0.8; }

.refresh-btn {
  background: rgba(59,130,246,.12); border: 1px solid rgba(59,130,246,.3);
  border-radius: 8px; padding: 7px 12px; color: #93c5fd; font-size: 0.78rem;
  font-family: 'Noto Sans TC', sans-serif; display: flex; align-items: center;
  gap: 5px; transition: all 0.2s;
}
.refresh-btn:hover:not(:disabled) { background: rgba(59,130,246,.22); }
.refresh-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ══ API Key 設定面板 ══ */
.settings-panel {
  background: #1e293b; border-bottom: 1px solid #334155;
  padding: 14px 20px; flex-shrink: 0;
}
.settings-inner { max-width: 800px; }
.settings-title { font-size: 0.88rem; font-weight: 700; color: #f1f5f9; margin-bottom: 6px; }
.settings-hint { font-size: 0.75rem; color: #64748b; margin-bottom: 10px; }
.settings-hint a { color: #3b82f6; text-decoration: none; }
.settings-row { display: flex; gap: 8px; flex-wrap: wrap; }
.key-input {
  flex: 1; min-width: 260px; background: #0f172a; border: 1px solid #334155;
  border-radius: 8px; padding: 9px 12px; color: #e2e8f0; font-size: 0.85rem;
  font-family: 'Noto Sans TC', sans-serif;
}
.key-input:focus { outline: none; border-color: #3b82f6; }
.key-input::placeholder { color: #475569; }
.save-btn {
  background: #3b82f6; border: none; border-radius: 8px; padding: 9px 16px;
  color: white; font-size: 0.85rem; font-family: 'Noto Sans TC', sans-serif;
  transition: background 0.2s;
}
.save-btn:hover { background: #2563eb; }
.clear-btn {
  background: transparent; border: 1px solid #334155; border-radius: 8px;
  padding: 9px 12px; color: #64748b; font-size: 0.85rem; font-family: 'Noto Sans TC', sans-serif;
}
.clear-btn:hover { border-color: #ef4444; color: #f87171; }

/* ══ 主版面 ══ */
.main-layout { display: flex; flex: 1; overflow: hidden; }

/* ══ 左側面板 ══ */
.sidebar {
  width: 360px; flex-shrink: 0; background: #1e293b;
  border-right: 1px solid #334155; display: flex; flex-direction: column; overflow: hidden;
}

/* 統計卡片 */
.stats-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; padding: 10px 14px; flex-shrink: 0; }
.stat-card { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 8px 4px; text-align: center; }
.stat-num { font-size: 1.2rem; font-weight: 700; line-height: 1; }
.stat-num.red    { color: #ef4444; }
.stat-num.orange { color: #f97316; }
.stat-num.yellow { color: #eab308; }
.stat-num.blue   { color: #3b82f6; }
.stat-label { font-size: 0.62rem; color: #64748b; margin-top: 3px; }

/* 篩選標籤 */
.filter-tabs { display: flex; gap: 5px; padding: 0 14px 8px; flex-shrink: 0; flex-wrap: wrap; }
.filter-btn {
  padding: 5px 12px; border: 1px solid #334155; border-radius: 20px;
  background: transparent; color: #64748b; font-size: 0.75rem;
  font-family: 'Noto Sans TC', sans-serif; transition: all 0.2s;
}
.filter-btn.active { background: #3b82f6; border-color: #3b82f6; color: white; }

/* 狀態訊息 */
.status-msg {
  margin: 0 14px 8px; border-radius: 8px; padding: 8px 12px; font-size: 0.78rem; flex-shrink: 0;
}
.status-msg.default { background: #0f172a; border: 1px solid #334155; color: #64748b; }
.status-msg.loading { background: rgba(59,130,246,.08); border: 1px solid #3b82f6; color: #93c5fd; }
.status-msg.success { background: rgba(34,197,94,.08);  border: 1px solid #22c55e; color: #86efac; }
.status-msg.error   { background: rgba(239,68,68,.08);  border: 1px solid #ef4444; color: #f87171; }

/* 地震列表 */
.quake-list { flex: 1; overflow-y: auto; padding: 0 14px 12px; display: flex; flex-direction: column; gap: 8px; }

.quake-card {
  background: #0f172a; border: 1px solid #334155; border-radius: 10px;
  padding: 12px 12px 10px; cursor: pointer; transition: all 0.2s;
}
.quake-card:hover { border-color: #475569; transform: translateX(2px); }
.quake-card.selected { border-color: #3b82f6 !important; }

.quake-top {
  display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px;
}

.mag-circle {
  width: 48px; height: 48px; border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.mag-label { font-size: 0.6rem; line-height: 1; }
.mag-val   { font-size: 1rem; font-weight: 700; line-height: 1; }

.quake-time-info { flex: 1; }
.quake-time { font-size: 0.78rem; color: #f1f5f9; font-weight: 500; }
.quake-ago  { font-size: 0.7rem; color: #cbd5e1; }

.quake-type-badge {
  font-size: 0.65rem; padding: 3px 8px; border-radius: 20px; font-weight: 600; flex-shrink: 0;
}
.quake-type-badge.sig { background: rgba(239,68,68,.15); color: #fca5a5; }
.quake-type-badge.sml { background: rgba(59,130,246,.15); color: #93c5fd; }

.quake-location { font-size: 0.85rem; color: #ffffff; margin-bottom: 5px; line-height: 1.4; font-weight: 600; }
.quake-meta { display: flex; gap: 12px; font-size: 0.8rem; color: #ffffff; font-weight: 500; align-items: center; }

/* 詳細資訊展開 */
.quake-detail {
  margin-top: 10px; padding-top: 10px; border-top: 1px solid #1e293b;
}
.detail-title {
  font-size: 0.8rem; font-weight: 700; color: #ffffff; margin-bottom: 6px; margin-top: 4px;
}
.intensity-grid { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
.intensity-item {
  padding: 3px 8px; border-radius: 6px; border: 1px solid;
  font-size: 0.72rem; display: flex; gap: 6px; align-items: center;
}
.area-county   { color: inherit; }
.area-intensity { font-weight: 700; }

.report-image-wrap { margin-bottom: 10px; }
.report-image { width: 100%; border-radius: 8px; border: 1px solid #334155; }

.report-link {
  display: block; font-size: 0.78rem; color: #3b82f6; text-decoration: none;
  padding: 6px 0; border-top: 1px solid #1e293b; margin-top: 6px;
}
.report-link:hover { color: #60a5fa; }

/* 空狀態 */
.empty { text-align: center; color: #cbd5e1; padding: 40px 0; font-size: 0.9rem; }
.no-key {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; padding: 60px 20px; color: #cbd5e1; text-align: center; font-size: 0.9rem;
}
.no-key div:first-child { font-size: 3rem; }
.no-key button {
  background: #3b82f6; border: none; border-radius: 8px; padding: 8px 16px;
  color: white; font-size: 0.85rem; font-family: 'Noto Sans TC', sans-serif;
}

/* ══ 地圖 ══ */
.map-area { flex: 1; }

/* ══ 動畫 ══ */
@keyframes spin { to { transform: rotate(360deg); } }
.spin { display: inline-block; animation: spin 0.8s linear infinite; }

.slide-down-enter-active, .slide-down-leave-active { transition: all 0.25s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-10px); }

.quake-item-enter-active { transition: all 0.3s ease; }
.quake-item-enter-from   { opacity: 0; transform: translateX(-10px); }
.quake-item-leave-active { transition: all 0.2s ease; position: absolute; width: 100%; }
.quake-item-leave-to     { opacity: 0; }

.expand-enter-active, .expand-leave-active { transition: all 0.3s ease; overflow: hidden; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; }
.expand-enter-to, .expand-leave-from { max-height: 600px; }

/* ══ 響應式 ══ */
@media (max-width: 768px) {
  .main-layout { flex-direction: column; }
  .sidebar { width: 100%; max-height: 55vh; border-right: none; border-bottom: 1px solid #334155; }
  .stats-row { grid-template-columns: repeat(2,1fr); }
  .header-right .update-time { display: none; }
}
</style>
