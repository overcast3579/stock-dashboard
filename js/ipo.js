/* ========================================
   ipo.js (Emerging Listing Progress)
   TAB 4: 興櫃掛牌進度
   ======================================== */

const IPO_API = 'https://www.tpex.org.tw/openapi/v1/tpex_esb_registration_announcements';

async function loadIPO() {
    hideElement('ipo-error');
    hideElement('ipo-table');
    showElement('ipo-loading');
    
    try {
        // 優先載入 GitHub Actions 抓取的穩定資料
        let rawData = null;
        try {
            const localRes = await fetch('data/ipo.json');
            if (localRes.ok) {
                rawData = await localRes.json();
                console.log('成功載入本地興櫃掛牌資料快照');
            }
        } catch (e) {
            console.warn('無法讀取本地 ipo.json，將嘗試 API 直連');
        }

        // 如果本地資料載入失敗，嘗試 API 直連 (透過 CORS Proxy)
        if (!rawData) {
            rawData = await fetchWithCorsProxy(IPO_API);
        }
        
        // 嘗試載入績效資料
        let performanceMap = {};
        try {
            const perfRes = await fetch('data/emerging-performance.json');
            if (perfRes.ok) {
                performanceMap = await perfRes.json();
            }
        } catch (e) {}

        // 取得今日日期 (YYYYMMDD)
        const now = new Date();
        const todayStr = now.getFullYear() + 
                         String(now.getMonth() + 1).padStart(2, '0') + 
                         String(now.getDate()).padStart(2, '0');
        
        const upcoming = [];
        const historic = [];
        
        rawData.forEach(item => {
            const listDate = item.ListingDate || '';
            // 日期 >= 今天 -> Upcoming
            if (!listDate || listDate >= todayStr) {
                upcoming.push(item);
            } else {
                historic.push(item);
            }
        });
        
        // 排序：即將掛牌 -> 日期由近到遠 (Asc)
        upcoming.sort((a, b) => {
            const dateA = a.ListingDate || '99999999';
            const dateB = b.ListingDate || '99999999';
            return dateA.localeCompare(dateB);
        });
        
        // 排序：已掛牌 -> 日期由遠到近 (Desc)
        historic.sort((a, b) => {
            const dateA = a.ListingDate || '00000000';
            const dateB = b.ListingDate || '00000000';
            return dateB.localeCompare(dateA);
        });
        
        const finalData = [...upcoming, ...historic];
        renderIPOTable(finalData, performanceMap, todayStr);
        
        hideElement('ipo-loading');
        showElement('ipo-table');
        document.getElementById('ipo-update-time').textContent = `共 ${finalData.length} 筆 · 最後更新 ${formatTimestamp()}`;
        
    } catch (error) {
        hideElement('ipo-loading');
        showError('ipo-error', `無法載入興櫃掛牌資料：${error.message}<br>這可能是因為 CORS 限制或是資料來源連線不穩定，建議將網頁推送至 GitHub 觸發自動化抓取後即可正常顯示。`);
        console.error('IPO 載入失敗:', error);
    }
}

function renderIPOTable(data, perfMap, todayStr) {
    const tbody = document.getElementById('ipo-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = data.map(item => {
        const code = item.SecuritiesCompanyCode;
        if (!code) return '';

        const listDate = item.ListingDate ? rocDateToAD(item.ListingDate) : '未定';
        const isAlreadyListed = item.ListingDate && item.ListingDate < todayStr;
        
        const perf = perfMap[code] || {};
        const d1_high = perf.d1_high || '-';
        const d1_close = perf.d1_close || '-';
        const d1_avg = perf.d1_avg || '-';
        const d2_open = perf.d2_open || '-';
        const d2_high = perf.d2_high || '-';
        const d2_close = perf.d2_close || '-';
        const d2_avg = perf.d2_avg || '-';
        
        const rowClass = isAlreadyListed ? 'historic-row' : 'upcoming-row';
        const dateStyle = isAlreadyListed ? 'color: var(--text-secondary);' : 'color: var(--up-color); font-weight: 700;';
        const statusText = isAlreadyListed ? '已掛牌交易' : (item.ListingDate ? '近期掛牌' : '登錄申請中');

        return `
            <tr class="${rowClass}">
                <td><span class="stock-code">${code}</span></td>
                <td><span class="stock-name" title="${item.CompanyName}">${item.CompanyName}</span></td>
                <td style="${dateStyle}">${listDate} <br><small style="font-size: 0.65rem; opacity: 0.7;">${statusText}</small></td>
                <td class="num">${item.OfferingPrice || '-'}</td>
                
                <td class="num">${d1_high}</td>
                <td class="num">${d1_close}</td>
                <td class="num">${d1_avg}</td>
                
                <td class="num">${d2_open}</td>
                <td class="num">${d2_high}</td>
                <td class="num">${d2_close}</td>
                <td class="num">${d2_avg}</td>
            </tr>
        `;
    }).join('');
}
