/* ========================================
   daily-emerging.js - TAB 2: 每日興櫃統計
   讀取 GitHub Actions 每日生成的 JSON
   包含成交量比較（vs 昨日）
   ======================================== */

let dailyData = [];

async function loadDailyEmerging() {
    hideElement('daily-error');
    hideElement('daily-table');
    hideElement('daily-info');
    hideElement('daily-filter');
    showElement('daily-loading');
    
    try {
        // 嘗試載入 GitHub Actions 生成的 JSON
        const [latestRes, prevRes] = await Promise.allSettled([
            fetch('data/emerging-latest.json'),
            fetch('data/emerging-prev.json'),
        ]);
        
        // 如果 latest JSON 不存在，顯示提示
        if (latestRes.status === 'rejected' || !latestRes.value.ok) {
            hideElement('daily-loading');
            showElement('daily-info');
            return;
        }
        
        const latestRaw = await latestRes.value.json();
        
        // 嘗試載入前日資料
        let prevMap = {};
        if (prevRes.status === 'fulfilled' && prevRes.value.ok) {
            const prevRaw = await prevRes.value.json();
            prevRaw.forEach(item => {
                prevMap[item.SecuritiesCompanyCode] = item;
            });
        }
        
        const hasPrevData = Object.keys(prevMap).length > 0;
        
        // 解析資料
        dailyData = latestRaw
            .filter(item => {
                const price = parseFloat(item.LatestPrice);
                return !isNaN(price) && price > 0;
            })
            .map(item => {
                const latestPrice = parseFloat(item.LatestPrice) || 0;
                const prevAvgPrice = parseFloat(item.PreviousAveragePrice) || 0;
                const change = prevAvgPrice > 0 ? latestPrice - prevAvgPrice : 0;
                const changePercent = prevAvgPrice > 0 ? ((latestPrice - prevAvgPrice) / prevAvgPrice) * 100 : 0;
                const volume = parseInt(item.TransactionVolume) || 0;
                
                // 成交量比較
                let volumeChange = null;
                if (hasPrevData) {
                    const prevItem = prevMap[item.SecuritiesCompanyCode];
                    if (prevItem) {
                        const prevVolume = parseInt(prevItem.TransactionVolume) || 0;
                        if (prevVolume > 0) {
                            volumeChange = ((volume - prevVolume) / prevVolume) * 100;
                        }
                    }
                }
                
                return {
                    code: item.SecuritiesCompanyCode,
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
        dailyData.sort((a, b) => b.changePercent - a.changePercent);
        
        renderDailyTable(hasPrevData);
        setupDailySort();
        setupDailyFilters(hasPrevData);
        
        hideElement('daily-loading');
        showElement('daily-table');
        showElement('daily-filter');
        
        // 更新 UI
        document.getElementById('daily-update-time').textContent = `資料日期: GitHub Actions 資料快照`;
        document.getElementById('daily-count').textContent = `${dailyData.length} 檔`;
        document.getElementById('daily-filter-result').innerHTML = `共 <span class="match-count">${dailyData.length}</span> 檔`;
        
        // 如果沒有昨日資料
        if (!hasPrevData) {
            const volumeFilter = document.getElementById('daily-volume-filter');
            if (volumeFilter) {
                volumeFilter.disabled = true;
                volumeFilter.placeholder = '尚無前一交易日資料';
            }
        }
        
    } catch (error) {
        hideElement('daily-loading');
        
        // 如果是 fetch 錯誤 (例如本地開發時 data/ 不存在)
        if (error instanceof TypeError) {
            showElement('daily-info');
        } else {
            showError('daily-error', `載入每日資料失敗：${error.message}`);
        }
        
        console.error('每日興櫃載入失敗:', error);
    }
}

function renderDailyTable(hasPrevData) {
    const tbody = document.getElementById('daily-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = dailyData.map(item => {
        const priceClass = getPriceClass(item.change);
        const changeStr = formatChange(item.change);
        const pctStr = formatPercent(item.changePercent);
        
        let volumeChangeStr = 'N/A';
        let volumeClass = 'price-flat';
        let volumeBadgeClass = '';
        
        if (hasPrevData && item.volumeChange !== null) {
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
    
    applyFilters('daily-table', 'daily-price-filter', 'daily-volume-filter', 'daily-filter-result', dailyData);
}

function setupDailySort() {
    setupTableSort('daily-table', dailyData, () => renderDailyTable(true));
}

function setupDailyFilters(hasPrevData) {
    const priceFilter = document.getElementById('daily-price-filter');
    const volumeFilter = document.getElementById('daily-volume-filter');
    
    const doFilter = () => {
        applyFilters('daily-table', 'daily-price-filter', 'daily-volume-filter', 'daily-filter-result', dailyData);
    };
    
    if (priceFilter) priceFilter.addEventListener('input', doFilter);
    if (volumeFilter && hasPrevData) volumeFilter.addEventListener('input', doFilter);
}
