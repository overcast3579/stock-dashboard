/* ========================================
   etf.js - TAB 3: 熱門 ETF 追蹤
   20 檔精選台灣 ETF
   ======================================== */

const ETF_LIST = [
    { code: '0050', name: '元大台灣50', type: '市值型' },
    { code: '0056', name: '元大高股息', type: '高股息' },
    { code: '006208', name: '富邦台50', type: '市值型' },
    { code: '00878', name: '國泰永續高股息', type: 'ESG高股息' },
    { code: '00919', name: '群益台灣精選高息', type: '高股息月配' },
    { code: '00929', name: '復華台灣科技優息', type: '科技高股息' },
    { code: '00940', name: '元大台灣價值高息', type: '價值高息' },
    { code: '00939', name: '統一台灣高息動能', type: '高息動能' },
    { code: '0051', name: '元大中型100', type: '中型股' },
    { code: '006201', name: '元大富櫃50', type: '櫃買型' },
    { code: '00713', name: '元大台灣高息低波', type: '高息低波' },
    { code: '00692', name: '富邦公司治理', type: '公司治理' },
    { code: '00881', name: '國泰台灣5G+', type: '5G/科技' },
    { code: '00891', name: '中信關鍵半導體', type: '半導體' },
    { code: '00757', name: '統一FANG+', type: '美股科技' },
    { code: '00830', name: '國泰費城半導體', type: '美國半導體' },
    { code: '00646', name: '元大S&P500', type: '美股大盤' },
    { code: '00662', name: '富邦NASDAQ', type: '美股科技' },
    { code: '00677U', name: '富邦VIX', type: '波動率' },
    { code: '00715L', name: '期街口布蘭特油正2', type: '原油槓桿' },
];

async function loadETF() {
    hideElement('etf-error');
    hideElement('etf-table');
    showElement('etf-loading');
    
    try {
        // 嘗試先讀 GitHub Actions 生成的 JSON
        let etfData = null;
        
        try {
            const localRes = await fetch('data/etf.json');
            if (localRes.ok) {
                etfData = await localRes.json();
            }
        } catch (e) {
            // 沒有本地資料，嘗試 API
        }
        
        if (etfData) {
            renderETFFromLocal(etfData);
        } else {
            // 透過 CORS Proxy 抓上櫃 ETF 資料
            await loadETFFromAPI();
        }
        
        hideElement('etf-loading');
        showElement('etf-table');
        document.getElementById('etf-update-time').textContent = `最後更新 ${formatTimestamp()}`;
        
    } catch (error) {
        hideElement('etf-loading');
        showError('etf-error', `無法載入 ETF 資料：${error.message}`);
        console.error('ETF 載入失敗:', error);
    }
}

async function loadETFFromAPI() {
    // 上櫃 ETF 使用 TPEx API
    const OTC_API = 'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes';
    
    try {
        const data = await fetchWithCorsProxy(OTC_API);
        
        // 建立查找 map
        const priceMap = {};
        data.forEach(item => {
            priceMap[item.SecuritiesCompanyCode] = item;
        });
        
        renderETFTable(priceMap);
    } catch (error) {
        // 如果 API 也失敗，顯示靜態清單
        renderETFTable({});
        console.warn('ETF API 載入失敗，顯示靜態清單:', error);
    }
}

function renderETFFromLocal(etfData) {
    const priceMap = {};
    etfData.forEach(item => {
        priceMap[item.code || item.SecuritiesCompanyCode] = item;
    });
    renderETFTable(priceMap);
}

function renderETFTable(priceMap) {
    const tbody = document.getElementById('etf-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = ETF_LIST.map(etf => {
        const data = priceMap[etf.code];
        
        let price = '-';
        let change = 0;
        let changePercent = 0;
        let priceClass = 'price-flat';
        
        if (data) {
            // 解析不同格式的 API 回傳
            const closePrice = parseFloat(data.Close || data.LatestPrice || data.close || data.price) || 0;
            const prevClose = parseFloat(data.PreviousClose || data.PreviousAveragePrice || data.prevClose) || 0;
            
            if (closePrice > 0) {
                price = closePrice.toFixed(2);
                if (prevClose > 0) {
                    change = closePrice - prevClose;
                    changePercent = (change / prevClose) * 100;
                }
                priceClass = getPriceClass(change);
            }
        }
        
        return `
            <tr>
                <td><span class="stock-code">${etf.code}</span></td>
                <td><span class="stock-name">${etf.name}</span></td>
                <td><span style="color: var(--text-secondary); font-size: 0.78rem;">${etf.type}</span></td>
                <td class="num ${priceClass}">${price}</td>
                <td class="num ${priceClass}">${change !== 0 ? formatChange(change) : '-'}</td>
                <td class="num ${priceClass}">${changePercent !== 0 ? formatPercent(changePercent) : '-'}</td>
            </tr>
        `;
    }).join('');
}

// 重新整理
document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('etf-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.classList.add('loading');
            loadETF().finally(() => {
                refreshBtn.classList.remove('loading');
            });
        });
    }
});
