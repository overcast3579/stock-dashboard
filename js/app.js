/* ========================================
   app.js - 全域工具函數、Tab 切換、CORS Proxy
   ======================================== */

// ===== CORS Proxy 設定 =====
const CORS_PROXIES = [
    // allorigins - 最穩定
    (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    // corsproxy.io
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    // cors-anywhere (備用)
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

async function fetchWithCorsProxy(url) {
    let lastError;
    
    // 先試直接請求 (在 GitHub Pages 部署後, 瀏覽器可能允許)
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
            const data = await res.json();
            return data;
        }
    } catch (e) {
        // CORS blocked, try proxy
    }
    
    // 依序嘗試 proxy
    for (let i = 0; i < CORS_PROXIES.length; i++) {
        const proxyFn = CORS_PROXIES[i];
        try {
            const proxyUrl = proxyFn(url);
            console.log(`嘗試 Proxy ${i + 1}:`, proxyUrl.substring(0, 60) + '...');
            const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(20000) });
            if (res.ok) {
                const text = await res.text();
                // allorigins /get endpoint 回傳 {contents: "...", status: {...}}
                try {
                    const parsed = JSON.parse(text);
                    // 如果回傳的是 allorigins 包裝格式
                    if (parsed.contents && typeof parsed.contents === 'string') {
                        return JSON.parse(parsed.contents);
                    }
                    // 如果直接是陣列或正常 JSON
                    if (Array.isArray(parsed) || (typeof parsed === 'object' && !parsed.contents)) {
                        return parsed;
                    }
                    return parsed;
                } catch (parseErr) {
                    console.warn(`Proxy ${i + 1} 回傳的不是有效 JSON:`, parseErr);
                    continue;
                }
            }
        } catch (e) {
            lastError = e;
            console.warn(`Proxy ${i + 1} 失敗:`, e.message);
        }
    }
    
    throw new Error(`所有 CORS Proxy 都無法連線: ${lastError?.message || '未知錯誤'}`);
}

// ===== 日期工具 =====
function getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

function formatTimestamp() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function rocDateToAD(rocDateStr) {
    // e.g. "1150424" → "2026/04/24", or "20260424" (AD format)
    if (!rocDateStr) return '-';
    
    const cleaned = rocDateStr.replace(/[\/\-]/g, '');
    
    if (cleaned.length === 7) {
        // ROC date: 1150424
        const rocYear = parseInt(cleaned.substring(0, 3));
        const month = cleaned.substring(3, 5);
        const day = cleaned.substring(5, 7);
        return `${rocYear + 1911}/${month}/${day}`;
    } else if (cleaned.length === 8) {
        // AD date: 20260424
        const year = cleaned.substring(0, 4);
        const month = cleaned.substring(4, 6);
        const day = cleaned.substring(6, 8);
        return `${year}/${month}/${day}`;
    }
    
    return rocDateStr;
}

// ===== 數字格式化 =====
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return Number(num).toLocaleString('zh-TW');
}

function formatPrice(price) {
    if (!price || price === '0' || price === '') return '-';
    const num = parseFloat(price);
    if (isNaN(num) || num === 0) return '-';
    return num.toFixed(2);
}

function formatPercent(pct) {
    if (pct === null || pct === undefined || isNaN(pct)) return '-';
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
}

function formatChange(change) {
    if (change === null || change === undefined || isNaN(change)) return '-';
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}`;
}

// ===== 漲跌 CSS class =====
function getPriceClass(change) {
    if (change > 0) return 'price-up';
    if (change < 0) return 'price-down';
    return 'price-flat';
}

// ===== 表格排序 =====
function setupTableSort(tableId, dataArray, renderFn) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const headers = table.querySelectorAll('th.sortable');
    let currentSort = { key: null, dir: 'desc' };
    
    headers.forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            
            // Toggle direction
            if (currentSort.key === key) {
                currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.key = key;
                currentSort.dir = 'desc';
            }
            
            // Update header classes
            headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
            th.classList.add(currentSort.dir === 'asc' ? 'sort-asc' : 'sort-desc');
            
            // Sort data
            dataArray.sort((a, b) => {
                let valA = a[key];
                let valB = b[key];
                
                // Handle numeric values
                if (typeof valA === 'number' && typeof valB === 'number') {
                    return currentSort.dir === 'asc' ? valA - valB : valB - valA;
                }
                
                // Handle NaN for numeric-like values
                if (!isNaN(valA) && !isNaN(valB)) {
                    valA = Number(valA) || 0;
                    valB = Number(valB) || 0;
                    return currentSort.dir === 'asc' ? valA - valB : valB - valA;
                }
                
                // String comparison
                valA = String(valA || '');
                valB = String(valB || '');
                return currentSort.dir === 'asc' 
                    ? valA.localeCompare(valB, 'zh-TW') 
                    : valB.localeCompare(valA, 'zh-TW');
            });
            
            renderFn();
        });
    });
}

// ===== 篩選邏輯 =====
function applyFilters(tableId, priceFilterId, volumeFilterId, resultId, dataArray) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    
    const priceInput = document.getElementById(priceFilterId);
    const volumeInput = document.getElementById(volumeFilterId);
    const resultEl = document.getElementById(resultId);
    
    const priceThreshold = priceInput && priceInput.value !== '' ? parseFloat(priceInput.value) : null;
    const volumeThreshold = volumeInput && !volumeInput.disabled && volumeInput.value !== '' ? parseFloat(volumeInput.value) : null;
    
    const rows = tbody.querySelectorAll('tr');
    let matchCount = 0;
    const total = rows.length;
    
    rows.forEach((row, i) => {
        const item = dataArray[i];
        if (!item) return;
        
        let show = true;
        
        if (priceThreshold !== null && (isNaN(item.changePercent) || item.changePercent < priceThreshold)) {
            show = false;
        }
        
        if (volumeThreshold !== null && (isNaN(item.volumeChange) || item.volumeChange < volumeThreshold)) {
            show = false;
        }
        
        if (show) {
            row.classList.remove('filtered-out');
            matchCount++;
        } else {
            row.classList.add('filtered-out');
        }
    });
    
    // 更新計數
    if (resultEl) {
        if (priceThreshold !== null || volumeThreshold !== null) {
            resultEl.innerHTML = `符合條件：<span class="match-count">${matchCount}</span> 檔 / 共 ${total} 檔`;
        } else {
            resultEl.innerHTML = `共 <span class="match-count">${total}</span> 檔`;
        }
    }
}

// ===== 顯示/隱藏元素 =====
function showElement(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
}

function hideElement(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

function showError(id, message) {
    const el = document.getElementById(id);
    if (el) {
        el.innerHTML = `
            <div class="error-icon">⚠️</div>
            <h3>載入失敗</h3>
            <p>${message}</p>
        `;
        el.style.display = '';
    }
}

// ===== Tab 切換 =====
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            // Update button states
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update panel visibility
            tabPanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === `panel-${targetTab}`) {
                    panel.classList.add('active');
                }
            });
        });
    });
}

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    // 設定日期
    document.getElementById('header-date').textContent = getTodayString();
    
    // 初始化 Tab
    initTabs();
    
    // 載入各 Tab 資料
    loadRealtimeEmerging();
    loadDailyEmerging();
    loadETF();
    loadIPO();
});
