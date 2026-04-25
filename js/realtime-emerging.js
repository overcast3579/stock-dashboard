/* ========================================
   realtime-emerging.js - TAB 1: 即時興櫃行情
   透過 CORS Proxy 即時抓取 TPEx API
   並讀取最新快照計算量比昨日
   ======================================== */

const EMERGING_API = 'https://www.tpex.org.tw/openapi/v1/tpex_esb_latest_statistics';

let realtimeData = [];

async function loadRealtimeEmerging() {
    hideElement('realtime-error');
    hideElement('realtime-table');
    showElement('realtime-loading');
    
    try {
        // 嘗試讀取最新快照 (代表前一交易日)
        let prevMap = {};
        try {
            const snapRes = await fetch('data/emerging-latest.json');
            if (snapRes.ok) {
                const snapData = await snapRes.json();
                snapData.forEach(item => {
                    prevMap[item.SecuritiesCompanyCode] = item;
                });
            }
        } catch (e) {
            console.log('未找到昨日快照資料');
        }

        const raw = await fetchWithCorsProxy(EMERGING_API);
        
        // 解析資料
        realtimeData = raw
            .filter(item => {
                const price = parseFloat(item.LatestPrice);
                return !isNaN(price) && price > 0;
            })
            .map(item => {
                const code = item.SecuritiesCompanyCode;
                const latestPrice = parseFloat(item.LatestPrice) || 0;
                const prevAvgPrice = parseFloat(item.PreviousAveragePrice) || 0;
                const change = prevAvgPrice > 0 ? latestPrice - prevAvgPrice : 0;
                const changePercent = prevAvgPrice > 0 ? ((latestPrice - prevAvgPrice) / prevAvgPrice) * 100 : 0;
                const volume = parseInt(item.TransactionVolume) || 0;
                
                // 計算量比昨日
                let volumeChange = null;
                const prevItem = prevMap[code];
                if (prevItem) {
                    const prevVolume = parseInt(prevItem.TransactionVolume) || 0;
                    if (prevVolume > 0) {
                        volumeChange = ((volume - prevVolume) / prevVolume) * 100;
                    }
                }
                
                return {
                    code: code,
                    name: item.CompanyName,
                    price: latestPrice,
                    prevPrice: prevAvgPrice,
                    change: change,
                    changePercent: changePercent,
                    volume: volume,
                    volumeChange: volumeChange,
                };
            });
        
        // 預設依漲幅排序
        realtimeData.sort((a, b) => b.changePercent - a.changePercent);
        
        renderRealtimeTable();
        setupRealtimeSort();
        setupRealtimeFilters();
        
        hideElement('realtime-loading');
        showElement('realtime-table');
        
        // 更新時間與計數
        document.getElementById('realtime-update-time').textContent = `最後更新 ${formatTimestamp()}`;
        document.getElementById('realtime-count').textContent = `${realtimeData.length} 檔`;
        
    } catch (error) {
        hideElement('realtime-loading');
        showError('realtime-error', `無法載入即時資料：${error.message}`);
        console.error('即時興櫃載入失敗:', error);
    }
}

function renderRealtimeTable() {
    const tbody = document.getElementById('realtime-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = realtimeData.map(item => {
        const priceClass = getPriceClass(item.change);
        const changeStr = formatChange(item.change);
        const pctStr = formatPercent(item.changePercent);
        
        let volumeChangeStr = 'N/A';
        let volumeClass = 'price-flat';
        let volumeBadgeClass = '';
        
        if (item.volumeChange !== null) {
            volumeChangeStr = formatPercent(item.volumeChange);
            volumeClass = getPriceClass(item.volumeChange);
            if (item.volumeChange >= 150) {
                volumeBadgeClass = ' hot';
            }
        }
        
        return `
            <tr>
                <td><span class="stock-code">${item.code}</span></td>
                <td><span class="stock-name">${item.name}</span></td>
                <td class="num ${priceClass}">${formatPrice(item.price)}</td>
                <td class="num ${priceClass}">${changeStr}</td>
                <td class="num ${priceClass}">${pctStr}</td>
                <td class="num">${formatNumber(item.volume)}</td>
                <td class="num"><span class="volume-badge${volumeBadgeClass} ${volumeClass}">${volumeChangeStr}</span></td>
            </tr>
        `;
    }).join('');
    
    applyFilters('realtime-table', 'realtime-price-filter', 'realtime-volume-filter', 'realtime-filter-result', realtimeData);
}

function setupRealtimeSort() {
    setupTableSort('realtime-table', realtimeData, renderRealtimeTable);
}

function setupRealtimeFilters() {
    const priceFilter = document.getElementById('realtime-price-filter');
    const volumeFilter = document.getElementById('realtime-volume-filter');
    
    const updateRealtimeFilters = () => {
        applyFilters('realtime-table', 'realtime-price-filter', 'realtime-volume-filter', 'realtime-filter-result', realtimeData);
    };

    if (priceFilter) priceFilter.addEventListener('input', updateRealtimeFilters);
    if (volumeFilter) {
        volumeFilter.disabled = false; // 啟用成交量篩選
        volumeFilter.placeholder = '例: 150';
        volumeFilter.addEventListener('input', updateRealtimeFilters);
        // 移除 label 的 disabled/note
        const group = volumeFilter.closest('.filter-group');
        if (group) {
            group.classList.remove('disabled');
            const note = group.querySelector('.filter-note');
            if (note) note.remove();
        }
    }
}

// 重新整理按鈕
document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('realtime-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.classList.add('loading');
            loadRealtimeEmerging().finally(() => {
                refreshBtn.classList.remove('loading');
            });
        });
    }
});
