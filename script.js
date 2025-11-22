document.addEventListener('DOMContentLoaded', () => {
    // -----------------------------------------------------------
    // 0. 초기 변수 설정
    // -----------------------------------------------------------
    const container = document.getElementById('quote-items-container');
    const addDateBtn = document.getElementById('add-date-btn'); 
    const finalTotalDisplay = document.getElementById('final-total');
    const supplyAmountDisplay = document.getElementById('supply-amount');
    const vatAmountDisplay = document.getElementById('vat-amount');
    const grandTotalDisplay = document.getElementById('grand-total');
    // reset button removed from UI
    const dateInput = document.getElementById('quote-date'); 
    
    const vatExclusiveRadio = document.getElementById('vat-exclusive');
    const vatInclusiveRadio = document.getElementById('vat-inclusive');
    
    const vatLabel = document.querySelector('.footer-table tr:nth-child(2) .total-label');
    
    const today = getFormattedDate(new Date());

    // 💡 추가된 요소 변수
    const saveQuoteBtn = document.getElementById('save-quote-btn'); 
    const viewListBtn = document.getElementById('view-list-btn'); 
    const printBtn = document.getElementById('print-btn');
    const containerDiv = document.querySelector('.container'); 
    const printToolsDiv = document.querySelector('.print-tools'); 

    // -----------------------------------------------------------
    // 1. 유틸리티 함수
    // -----------------------------------------------------------
    
    function getFormattedDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // 텍스트 길이에 따라 폰트 크기 자동 조정 함수
    function adjustFontSize(input) {
        if (!input || (!input.classList.contains('item-name') && !input.classList.contains('item-spec'))) {
            return;
        }
        
        // 기본 폰트 크기와 최소 폰트 크기 설정
        const baseFontSize = 12;
        const minFontSize = 8;
        
        const text = input.value || '';
        if (!text.trim()) {
            // 텍스트가 없으면 기본 크기로 복원
            input.style.fontSize = '';
            return;
        }
        
        // 입력 필드의 실제 너비 가져오기
        const computedStyle = window.getComputedStyle(input);
        const inputWidth = input.clientWidth - parseFloat(computedStyle.paddingLeft) - parseFloat(computedStyle.paddingRight);
        
        // 측정용 임시 요소 생성
        const measure = document.createElement('span');
        measure.style.visibility = 'hidden';
        measure.style.position = 'absolute';
        measure.style.top = '-9999px';
        measure.style.left = '-9999px';
        measure.style.whiteSpace = 'nowrap';
        measure.style.fontSize = baseFontSize + 'px';
        measure.style.fontFamily = computedStyle.fontFamily;
        measure.style.fontWeight = computedStyle.fontWeight;
        measure.style.letterSpacing = computedStyle.letterSpacing;
        measure.textContent = text;
        document.body.appendChild(measure);
        
        // 텍스트 너비 측정
        const textWidth = measure.offsetWidth;
        document.body.removeChild(measure);
        
        // 텍스트가 칸을 넘어가면 폰트 크기 조정
        if (textWidth > inputWidth && inputWidth > 0) {
            // 비율 계산하여 폰트 크기 조정
            const ratio = inputWidth / textWidth;
            let newFontSize = Math.max(minFontSize, Math.floor(baseFontSize * ratio * 0.9)); // 여유 공간을 위해 0.9 곱함
            
            input.style.fontSize = newFontSize + 'px';
        } else {
            // 텍스트가 칸 안에 들어가면 기본 크기로 복원
            input.style.fontSize = '';
        }
    }
    
    function getDisplayDate(dateString) {
        if (!dateString) return '';
        try {
            const groupDate = new Date(dateString + 'T00:00:00');
            return groupDate.toLocaleDateString('ko-KR', {
                month: 'long',
                day: 'numeric',
                weekday: 'short'
            });
        } catch(e) {
            return '';
        }
    }

    function formatNumber(num) {
        if (isNaN(num) || num === 0 || num === null || num === undefined) return '0';
        return Math.round(num).toLocaleString('ko-KR');
    }
    
    function parseNumber(str) {
        if (str === null || str === undefined || str === '') return 0;
        try {
            const cleanStr = String(str).replace(/[^0-9.]/g, '');
            return parseFloat(cleanStr) || 0;
        } catch (e) {
            return 0;
        }
    }

    // Format quantity for display: integers shown without decimal, otherwise one decimal place
    function formatQuantityDisplay(q) {
        if (q === null || q === undefined || q === '') return '';
        const n = parseFloat(q);
        if (isNaN(n)) return '';
        if (Number.isInteger(n)) return String(Math.round(n));
        return n.toFixed(1);
    }

    // ---------- itemSets 저장/로드/검색 유틸 ----------
    function loadItemSets() {
        try {
            const raw = localStorage.getItem('itemSets');
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.error('loadItemSets error', e);
            return [];
        }
    }

    function findItemSetByName(name) {
        if (!name) return null;
        const sets = loadItemSets();
        const lower = name.trim().toLowerCase();
        return sets.find(s => s.name && s.name.trim().toLowerCase() === lower) || null;
    }

    function saveItemSets(list) {
        try {
            localStorage.setItem('itemSets', JSON.stringify(list || []));
        } catch (e) {
            console.error('saveItemSets error', e);
        }
    }

    function upsertItemSet(set) {
        if (!set || !set.name) return;
        const nameKey = set.name.trim().toLowerCase();
        const sets = loadItemSets();
        const idx = sets.findIndex(s => s.name && s.name.trim().toLowerCase() === nameKey);
        const now = Date.now();
        if (idx >= 0) {
            // preserve usageCount/lastUsed if present
            const existing = sets[idx];
            existing.spec = set.spec || existing.spec || '';
            existing.unit = set.unit || existing.unit || '';
            existing.unitPrice = (set.unitPrice !== undefined) ? parseNumber(set.unitPrice) : (existing.unitPrice || 0);
            existing.lastSaved = now; // latest saved timestamp
            sets[idx] = existing;
        } else {
            sets.unshift({
                name: set.name || '',
                spec: set.spec || '',
                unit: set.unit || '',
                unitPrice: parseNumber(set.unitPrice) || 0,
                usageCount: 0,
                lastUsed: null,
                lastSaved: now
            });
        }
        saveItemSets(sets);
    }

    function incrementItemUsage(name) {
        if (!name) return;
        const sets = loadItemSets();
        const idx = sets.findIndex(s => s.name && s.name.trim().toLowerCase() === name.trim().toLowerCase());
        if (idx >= 0) {
            sets[idx].usageCount = (sets[idx].usageCount || 0) + 1;
            sets[idx].lastUsed = Date.now();
            saveItemSets(sets);
        }
    }

    function findItemSetsByPartial(query, limit = 8) {
        if (!query) return [];
        const q = query.trim().toLowerCase();
        const sets = loadItemSets();
        // filter partial match in name
        const filtered = sets.filter(s => s.name && s.name.toLowerCase().includes(q));
        // sort by usageCount desc, lastUsed desc, lastSaved desc
        filtered.sort((a, b) => {
            const ua = a.usageCount || 0; const ub = b.usageCount || 0;
            if (ua !== ub) return ub - ua;
            const la = a.lastUsed || 0; const lb = b.lastUsed || 0;
            if (la !== lb) return lb - la;
            const sa = a.lastSaved || 0; const sb = b.lastSaved || 0;
            return sb - sa;
        });
        return filtered.slice(0, limit);
    }

    // ---------- Empty-name rows helper ----------
    function handleEmptyNameRowsBeforeAction(actionLabel) {
        try {
            // Gather empty rows info from current in-memory dateGroups (fallback to stored quoteData)
            const groups = Array.isArray(dateGroups) && dateGroups.length ? dateGroups : (JSON.parse(localStorage.getItem('quoteData')) || []);
            let emptyCount = 0;
            groups.forEach(g => {
                if (!g || !Array.isArray(g.items)) return;
                g.items.forEach(it => {
                    if (!it || !(it.name || '').toString().trim()) emptyCount++;
                });
            });

            if (emptyCount === 0) return true; // nothing to do

            const confirmMsg = `테이블에 품명이 없는 ${emptyCount}개의 행이 있습니다. 품명이 없는 행을 지우겠습니까?`;
            const shouldDelete = confirm(confirmMsg);
            if (!shouldDelete) {
                // user chose No — keep screen
                return false;
            }

            // User chose Yes: remove empty-name items
            // operate on in-memory dateGroups; if empty, try to load from storage
            if (!Array.isArray(dateGroups) || dateGroups.length === 0) {
                dateGroups = JSON.parse(localStorage.getItem('quoteData')) || [];
            }

            // Remove items with empty name
            dateGroups = dateGroups.map(g => {
                if (!g || !Array.isArray(g.items)) return g;
                const remaining = g.items.filter(it => (it && (it.name || '').toString().trim()));
                return Object.assign({}, g, { items: remaining });
            }).filter(g => g && Array.isArray(g.items) && g.items.length > 0);

            // Ensure at least one empty group exists if everything got removed
            if (!Array.isArray(dateGroups) || dateGroups.length === 0) {
                const today = getFormattedDate(new Date());
                dateGroups = [{ date: today, items: [{ name:'', spec:'', quantity:'', unit:'', unitPrice:'', totalPrice:'', note:'', date: today }] }];
            }

            // persist and re-render
            saveData();
            render();
            return true;
        } catch (e) {
            console.error('handleEmptyNameRowsBeforeAction error', e);
            return true; // on error, allow action to continue to avoid blocking user
        }
    }

    // ---------- Missing-fields check before print (modal) ----------
    function checkMissingFieldsBeforePrint(callback) {
        try {
            const groups = Array.isArray(dateGroups) && dateGroups.length ? dateGroups : (JSON.parse(localStorage.getItem('quoteData')) || []);
            const problems = [];
            groups.forEach((g, gi) => {
                const groupDate = g && g.date ? g.date : '';
                if (!g || !Array.isArray(g.items)) return;
                g.items.forEach((it, ii) => {
                    if (!it) return;
                    const name = (it.name || '').toString().trim();
                    if (!name) return; // only consider rows with a name
                    const missing = [];
                    // quantity: check numeric and non-zero? user asked presence; we'll treat empty/zero as missing
                    const qty = parseNumber(it.quantity);
                    if (!it.quantity || qty === 0) missing.push('수량');
                    if (!it.unit || !(it.unit.toString().trim())) missing.push('단위');
                    const up = parseNumber(it.unitPrice);
                    if (!it.unitPrice || up === 0) missing.push('단가');
                    if (missing.length) {
                        problems.push({ groupDate, name, missing });
                    }
                });
            });

            if (!problems.length) {
                callback(true);
                return;
            }

            // render modal with readable list
            const existing = document.getElementById('missing-fields-modal');
            if (existing) existing.remove();
            const modal = document.createElement('div');
            modal.id = 'missing-fields-modal';
            modal.style.position = 'fixed';
            modal.style.left = 0;
            modal.style.top = 0;
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.background = 'rgba(0,0,0,0.45)';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.zIndex = 10000;

            const box = document.createElement('div');
            box.className = 'modal-box';
            box.style.width = '760px';
            box.style.maxHeight = '80%';
            box.style.overflow = 'auto';
            box.style.background = '#fff';
            box.style.padding = '16px';
            box.style.boxSizing = 'border-box';
            box.style.borderRadius = '8px';

            const header = document.createElement('div');
            header.innerHTML = `<h3>인쇄 전 확인 — 누락된 필드가 있습니다</h3><p>다음 항목들은 품명이 적혀있지만 일부 필드가 비어 있습니다. 계속 인쇄하려면 "계속"을 누르세요. 편집하려면 "취소"를 눌러 화면에 남겨두세요.</p>`;
            box.appendChild(header);

            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.innerHTML = `<thead><tr style="background:#f7f7f7;"><th style="padding:8px; text-align:left;">작업일</th><th style="padding:8px; text-align:left;">품명</th><th style="padding:8px; text-align:left;">누락 항목</th></tr></thead>`;
            const tbody = document.createElement('tbody');
            problems.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td style="padding:8px; border-bottom:1px solid #eee;">${p.groupDate}</td><td style="padding:8px; border-bottom:1px solid #eee;">${p.name}</td><td style="padding:8px; border-bottom:1px solid #eee; color:#d9534f; font-weight:600;">${p.missing.join(', ')}</td>`;
                tbody.appendChild(tr);
            });
            table.appendChild(tbody);
            box.appendChild(table);

            const actions = document.createElement('div');
            actions.style.textAlign = 'right';
            actions.style.marginTop = '12px';
            actions.innerHTML = `<button id="missing-cancel-btn">취소</button> <button id="missing-proceed-btn" style="margin-left:8px;">계속 인쇄</button>`;
            box.appendChild(actions);

            modal.appendChild(box);
            document.body.appendChild(modal);

            box.querySelector('#missing-cancel-btn').onclick = () => {
                modal.remove();
                callback(false);
            };
            box.querySelector('#missing-proceed-btn').onclick = () => {
                modal.remove();
                callback(true);
            };
        } catch (e) {
            console.error('checkMissingFieldsBeforePrint error', e);
            callback(true); // allow printing on error
        }
    }

    // 💡 날짜 중복 검사 함수
    function checkDateUniqueness(date, currentGroupIndex = -1) {
        if (dateGroups.length <= 1) return true;
        
        const isDuplicate = dateGroups.some((group, index) => {
            // 현재 검사 중인 그룹은 제외
            if (index === currentGroupIndex) return false;
            
            // 그룹의 첫 번째 항목에 저장된 날짜와 비교
            return group.items[0]?.date === date;
        });

        if (isDuplicate) {
            alert(`"${getDisplayDate(date)}"는 이미 다른 그룹에서 사용 중인 날짜입니다. 다른 날짜를 선택해주세요.`);
            return false;
        }
        return true;
    }
    
    // 💡 날짜 그룹을 오름차순으로 정렬하는 함수
    function sortDateGroups() {
        dateGroups.sort((a, b) => {
            // 그룹의 첫 번째 항목 날짜를 기준으로 비교
            const dateA = new Date(a.items[0].date + 'T00:00:00'); 
            const dateB = new Date(b.items[0].date + 'T00:00:00');
            return dateA - dateB; // 오름차순 정렬
        });
    }

    // -----------------------------------------------------------
    // 2. 데이터 저장/로드
    // -----------------------------------------------------------
    function saveData() {
        // 리스트 모드이거나 DOM 요소가 없으면 저장하지 않음
        if (containerDiv.classList.contains('list-mode')) {
            return;
        }
        
        // 현재 작업 중인 청구서 임시 데이터 저장
        localStorage.setItem('quoteData', JSON.stringify(dateGroups));
        
        // DOM 요소가 존재하는지 확인 후 저장
        if (dateInput) {
            localStorage.setItem('quoteDate', dateInput.value);
        }
        
        const vatModeRadio = document.querySelector('input[name="vat-mode"]:checked');
        if (vatModeRadio) {
            localStorage.setItem('vatMode', vatModeRadio.value);
        }
        
        // 수신자/현장명 등 정보 저장
        const fieldSiteEl = document.getElementById('field-site');
        const fieldSiteInput = fieldSiteEl ? fieldSiteEl.querySelector('input') : null;
        const clientNameEl = document.getElementById('client-name');
        const clientContactEl = document.getElementById('client-contact');
        const clientPhoneEl = document.getElementById('client-phone');
        
        localStorage.setItem('clientInfo', JSON.stringify({
             site: fieldSiteInput ? fieldSiteInput.value : '현장명을 기재해주세요',
             clientName: clientNameEl ? clientNameEl.value : '',
             clientContact: clientContactEl ? clientContactEl.value : '',
             clientPhone: clientPhoneEl ? clientPhoneEl.value : '',
        }));
        
        // 계좌 정보 저장
        const bankNameEl = document.getElementById('bank-name');
        const bankAccountEl = document.getElementById('bank-account');
        const accountHolderEl = document.getElementById('account-holder');
        
        localStorage.setItem('bankInfo', JSON.stringify({
            bankName: bankNameEl ? bankNameEl.value : '국민은행',
            bankAccount: bankAccountEl ? bankAccountEl.value : '123456-78-90123',
            accountHolder: accountHolderEl ? accountHolderEl.value : '홍길동',
        }));
    }

    function loadDateGroups() {
        const data = localStorage.getItem('quoteData');
        const loadedDate = localStorage.getItem('quoteDate');
        const loadedVatMode = localStorage.getItem('vatMode'); 
        const loadedClientInfo = localStorage.getItem('clientInfo');
        const loadedBankInfo = localStorage.getItem('bankInfo');
        
        // DOM 요소가 존재하는지 확인 후 설정
        if (loadedDate && dateInput) {
            dateInput.value = loadedDate;
        }

        if (loadedClientInfo) {
            try {
                const info = JSON.parse(loadedClientInfo);
                const fieldSiteEl = document.getElementById('field-site');
                if (fieldSiteEl) {
                    const fieldSiteInput = fieldSiteEl.querySelector('input');
                    if (fieldSiteInput) {
                        fieldSiteInput.value = info.site || '현장명을 기재해주세요';
                    }
                }
                
                const clientNameEl = document.getElementById('client-name');
                if (clientNameEl) clientNameEl.value = info.clientName || '';
                
                const clientContactEl = document.getElementById('client-contact');
                if (clientContactEl) clientContactEl.value = info.clientContact || '';
                
                const clientPhoneEl = document.getElementById('client-phone');
                if (clientPhoneEl) clientPhoneEl.value = info.clientPhone || '';
            } catch (e) {
                console.error("Error parsing clientInfo from localStorage", e);
            }
        }

        // 계좌 정보 로드
        if (loadedBankInfo) {
            try {
                const bankInfo = JSON.parse(loadedBankInfo);
                const bankNameEl = document.getElementById('bank-name');
                if (bankNameEl) bankNameEl.value = bankInfo.bankName || '국민은행';
                
                const bankAccountEl = document.getElementById('bank-account');
                if (bankAccountEl) bankAccountEl.value = bankInfo.bankAccount || '123456-78-90123';
                
                const accountHolderEl = document.getElementById('account-holder');
                if (accountHolderEl) accountHolderEl.value = bankInfo.accountHolder || '홍길동';
            } catch (e) {
                console.error("Error parsing bankInfo from localStorage", e);
            }
        }

        if (loadedVatMode === 'inclusive' && vatInclusiveRadio) {
            vatInclusiveRadio.checked = true;
        } else if (vatExclusiveRadio) {
            vatExclusiveRadio.checked = true; 
        }

        try {
            const parsedData = data ? JSON.parse(data) : [];
            return Array.isArray(parsedData) ? parsedData : [];
        } catch (e) {
            console.error("Error parsing quoteData from localStorage", e);
            return [];
        }
    }

    // 💡 추가: 저장된 청구서 리스트 로드
    function loadSavedQuotes() {
        const savedData = localStorage.getItem('savedQuotes');
        try {
            return savedData ? JSON.parse(savedData) : [];
        } catch (e) {
            console.error("Error parsing savedQuotes from localStorage", e);
            return [];
        }
    }

    // -----------------------------------------------------------
    // 3. 데이터 초기 설정 및 로드
    // -----------------------------------------------------------
    
    dateInput.value = today; 
    let dateGroups = loadDateGroups(); 
    
    if (dateGroups.length === 0) {
        dateGroups = [{
            date: today, 
            items: [
                { name: '', spec: '', quantity: '', unit: '', unitPrice: '', totalPrice: '', note: '', date: today }
            ]
        }];
    } else {
        dateGroups.forEach(group => {
            group.items.forEach(item => {
                if (!item.date) {
                    item.date = group.date || today;
                }
            });
        });
    }

    // -----------------------------------------------------------
    // 4. 계산 로직
    // -----------------------------------------------------------
    
    function calculateGroupSubtotal(group) {
        let subtotal = 0;
        group.items.forEach(item => {
            subtotal += (item.quantity * item.unitPrice) || 0;
        });
        return subtotal;
    }

    function calculateTotals() {
        const isVatInclusive = vatInclusiveRadio.checked;
        let baseTotal = 0;

        dateGroups.forEach(group => {
            // 품목별 총액 계산
            group.items.forEach(item => {
                const total = (item.quantity * item.unitPrice) || 0; 
                item.totalPrice = total;
            });
            // 그룹 소계 계산 및 저장
            group.subtotal = calculateGroupSubtotal(group);
            baseTotal += group.subtotal;
        });
        
        let totalSupply;
        let vat;
        let grandTotal;
        
        if (isVatInclusive) {
            totalSupply = baseTotal;
            grandTotal = baseTotal; 
            vat = 0; 
            vatLabel.textContent = '부가세 없음';

        } else {
            totalSupply = baseTotal;
            vat = Math.round(totalSupply * 0.1); 
            grandTotal = totalSupply + vat;
            vatLabel.textContent = '부가세 (VAT 10%)';
        }

        supplyAmountDisplay.textContent = formatNumber(totalSupply);
        vatAmountDisplay.textContent = formatNumber(vat);
        grandTotalDisplay.textContent = formatNumber(grandTotal);
        finalTotalDisplay.textContent = formatNumber(grandTotal);
        saveData();

        // 최종 금액 반환
        return { grandTotal: grandTotal }; 
    }

    // -----------------------------------------------------------
    // 5. 항목 렌더링
    // -----------------------------------------------------------
    function renderItemTable(group, targetContainer, groupIndex) { 
        targetContainer.innerHTML = '';
        const itemsArray = group.items;
        
        const table = document.createElement('table');
        table.className = `quote-table`;
        table.innerHTML = `
            <thead>
                <tr>
                    <th>작업일</th> 
                    <th>품명</th>
                    <th>규격</th>
                    <th>수량</th>
                    <th>단위</th>
                    <th>단가</th>
                    <th>공급가액</th>
                    <th>비고</th>
                    <th>X</th> 
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');

        itemsArray.forEach((item, itemIndex) => {
            const tr = document.createElement('tr');
            tr.dataset.itemIndex = itemIndex;
            
            let dateCellContent = '';
            let dateCell = '';

            if (itemIndex === 0) {
                // 날짜 입력 필드는 첫 번째 행에만 표시
                dateCellContent = `
                    <input type="date" 
                            value="${item.date || today}" 
                            class="item-date-input" 
                            data-group-index="${groupIndex}" 
                            data-item-index="${itemIndex}">
                    <span class="date-display" style="display:none;">${getDisplayDate(item.date || today)}</span>
                `;
                // 셀 병합 (소계 행 포함)
                dateCell = `<td class="group-date-cell" rowspan="${itemsArray.length + 1}"> ${dateCellContent} </td>`; 
            }
            
            tr.innerHTML = `
                ${dateCell}
                <td><input type="text" value="${item.name || ''}" class="item-name" data-group-index="${groupIndex}" data-item-index="${itemIndex}"></td>
                <td><input type="text" value="${item.spec || ''}" class="item-spec" data-group-index="${groupIndex}" data-item-index="${itemIndex}"></td>
                <td>
                    <input type="text" 
                            value="${formatQuantityDisplay(item.quantity)}" 
                            class="item-quantity text-numeric" 
                            data-group-index="${groupIndex}" 
                            data-item-index="${itemIndex}">
                </td>
                <td><input type="text" value="${item.unit || ''}" class="item-unit" data-group-index="${groupIndex}" data-item-index="${itemIndex}"></td>
                <td>
                    <input type="text" 
                            value="${formatNumber(item.unitPrice)}" 
                            class="item-unit-price text-numeric"
                            data-group-index="${groupIndex}" 
                            data-item-index="${itemIndex}">
                </td>
                <td class="item-total">${formatNumber(item.totalPrice)}</td>
                <td><input type="text" value="${item.note || ''}" class="item-note" data-group-index="${groupIndex}" data-item-index="${itemIndex}"></td>
                <td><button class="delete-item-btn-internal">X</button></td>
            `;
            // 첫 번째 행이 아닌 경우 (dateCell이 비어있는 경우)
            if (itemIndex === 0) {
                 tbody.appendChild(tr);
            } else {
                 const firstTd = tr.querySelector('td:first-child');
                 if (firstTd && firstTd.classList.contains('group-date-cell')) {
                    firstTd.remove(); // 이미 병합된 셀이 추가되었으므로 제거
                 }
                 tbody.appendChild(tr);
            }
        });

        // 소계 행 추가
        const subtotalRow = document.createElement('tr');
        subtotalRow.className = 'subtotal-row';
        const colSpanValue = 8; 
        
        subtotalRow.innerHTML = `
            <td class="subtotal-label" colspan="${colSpanValue - 2}">소계</td> 
            <td colspan="1">${formatNumber(group.subtotal)}</td> 
            <td colspan="1"></td> `;
        tbody.appendChild(subtotalRow);

        targetContainer.appendChild(table);

        // 렌더링 후 품명과 규격 필드의 폰트 크기 자동 조정
        setTimeout(() => {
            const nameInputs = targetContainer.querySelectorAll('.item-name');
            const specInputs = targetContainer.querySelectorAll('.item-spec');
            nameInputs.forEach(input => adjustFontSize(input));
            specInputs.forEach(input => adjustFontSize(input));
        }, 0);

        // 테이블 아래에 줄 추가 버튼 생성
        const addItemRowBtn = document.createElement('button');
        addItemRowBtn.className = 'add-item-row-btn';
        addItemRowBtn.dataset.groupIndex = groupIndex;
        addItemRowBtn.textContent = `➕ [${getDisplayDate(itemsArray[0]?.date || today)}] 품목 줄 추가`;
        targetContainer.appendChild(addItemRowBtn);
    }
    
    function render() {
        // 현재 모드가 청구서 작성 모드일 때만 렌더링
        if (containerDiv.classList.contains('list-mode')) {
             return; 
        }

        container.innerHTML = '';
        dateGroups.forEach((group, groupIndex) => {
            const dateGroupDiv = document.createElement('div');
            dateGroupDiv.className = 'date-group';
            dateGroupDiv.dataset.groupIndex = groupIndex;

            // 그룹 헤더: 전체 삭제 버튼
            const dateHeader = document.createElement('div');
            dateHeader.className = 'date-header';
            dateHeader.innerHTML = `
                <div>
                    <button class="delete-date-btn" data-group-index="${groupIndex}">X 전체 삭제</button>
                </div>
            `;
            dateGroupDiv.appendChild(dateHeader);

            // 테이블 및 줄 추가 버튼 렌더링
            const tableWrapper = document.createElement('div');
            renderItemTable(group, tableWrapper, groupIndex);
            dateGroupDiv.appendChild(tableWrapper);

            container.appendChild(dateGroupDiv);
        });
        
        calculateTotals();
        
        attachDynamicEventListeners(); 
    }


    // -----------------------------------------------------------
    // 6. 이벤트 리스너 (동적 요소)
    // -----------------------------------------------------------
    function attachDynamicEventListeners() {
        // 테이블 내 줄 추가 버튼
        document.querySelectorAll('.add-item-row-btn').forEach(btn => {
            btn.onclick = (e) => {
                const groupIndex = parseInt(e.target.dataset.groupIndex);
                const currentGroup = dateGroups[groupIndex];
                
                const dateToUse = currentGroup.items[0]?.date || today;

                currentGroup.items.push({ 
                    name: '', spec: '', quantity: '', unit: '', unitPrice: '', totalPrice: '', note: '', date: dateToUse 
                });
                render();
            };
        });
        
        // 품목 날짜 변경 (테이블 내부) - 중복 검사 로직 추가
        document.querySelectorAll('.item-date-input').forEach(input => {
            const originalDate = input.value; 

            input.onchange = (e) => {
                const groupIndex = parseInt(e.target.dataset.groupIndex);
                const newDate = e.target.value;
                
                // 1. 날짜 중복 검사
                if (!checkDateUniqueness(newDate, groupIndex)) {
                    e.target.value = originalDate; 
                    return;
                }
                
                // 2. 중복 없을 시, 그룹 내 모든 항목의 날짜를 업데이트
                dateGroups[groupIndex].items.forEach(item => {
                    item.date = newDate;
                });
                
                sortDateGroups(); 
                
                saveData(); 
                render(); 
            };
        });

        // 날짜 그룹 (테이블 전체) 삭제
        document.querySelectorAll('.delete-date-btn').forEach(btn => {
            btn.onclick = (e) => {
                const groupIndex = parseInt(e.target.dataset.groupIndex);
                
                if (dateGroups.length > 1 && confirm('이 그룹 (작업일, 품목 전체)을 정말로 삭제하시겠습니까?')) {
                    dateGroups.splice(groupIndex, 1);
                    render();
                } else if (dateGroups.length === 1) {
                    alert('최소한 하나의 그룹은 유지해야 합니다.');
                    return; 
                }
            };
        });

        // 항목 개별 삭제 (테이블 내부 버튼 로직)
        document.querySelectorAll('.delete-item-btn-internal').forEach(btn => {
            btn.onclick = (e) => {
                const tr = e.target.closest('tr');
                const itemIndex = parseInt(tr.dataset.itemIndex);

                const dateGroupDiv = e.target.closest('.date-group');
                const groupIndex = parseInt(dateGroupDiv.dataset.groupIndex);
                
                const groupItems = dateGroups[groupIndex].items;

                if (groupItems.length > 1) {
                    groupItems.splice(itemIndex, 1);
                } else {
                    alert('그룹에는 최소한 하나의 품목이 있어야 합니다. 품목을 완전히 지우려면 "X 전체 삭제"를 사용하세요.');
                    return;
                }
                
                render();
            };
        });
    }

    // -----------------------------------------------------------
    // 7. 이벤트 리스너 (정적 요소)
    // -----------------------------------------------------------
    
    // 날짜 그룹 추가 버튼 (페이지 최하단)
    addDateBtn.onclick = () => {
        const newGroupDate = getFormattedDate(new Date()); 
        
        if (!checkDateUniqueness(newGroupDate)) {
             return;
        }

        dateGroups.push({
            date: newGroupDate, 
            items: [
                { name: '', spec: '', quantity: '', unit: '', unitPrice: '', totalPrice: '', note: '', date: newGroupDate }
            ]
        });
        
        sortDateGroups(); 
        
        render(); 
    };
    
    // 입력 값 변경 감지 (oninput)
    document.oninput = (e) => {
        const input = e.target;
        const tr = input.closest('tr');
        if (!tr || !input.closest('#quote-items-container')) return; 

        const dateGroupDiv = input.closest('.date-group');
        const groupIndex = parseInt(dateGroupDiv.dataset.groupIndex);
        const itemIndex = parseInt(tr.dataset.itemIndex);
        let item = dateGroups[groupIndex].items[itemIndex];

        if (input.classList.contains('item-name')) {
            item.name = input.value;
            // 품명 필드 폰트 크기 자동 조정
            adjustFontSize(input);
            // 부분일치 추천 드롭다운 표시
            try {
                showAutocompleteSuggestions(input, input.value || '');
            } catch (e) {
                console.error('추천 표시 중 오류', e);
            }
        }
        if (input.classList.contains('item-spec')) {
            item.spec = input.value;
            // 규격 필드 폰트 크기 자동 조정
            adjustFontSize(input);
        }
        if (input.classList.contains('item-unit')) item.unit = input.value;
        if (input.classList.contains('item-note')) item.note = input.value;

        // 수량 처리
        if (input.classList.contains('item-quantity')) {
            const cleanValue = input.value.replace(/[^0-9.]/g, '');
            input.value = cleanValue; 
            item.quantity = parseNumber(cleanValue); 
        }
        
        // 단가 처리 (천 단위 쉼표 포맷)
        if (input.classList.contains('item-unit-price')) {
            const rawValue = parseNumber(input.value);
            item.unitPrice = rawValue;

            const cursorStart = input.selectionStart;
            const formattedValue = formatNumber(rawValue);
            const commaCountBefore = (input.value.match(/,/g) || []).length;
            const commaCountAfter = (formattedValue.match(/,/g) || []).length;
            const diff = commaCountAfter - commaCountBefore;
            
            input.value = formattedValue;

            let newCursorPosition = cursorStart + diff;
            if (cursorStart >= input.value.length - 1 && rawValue.toString().length === parseNumber(input.value).toString().length) {
                 newCursorPosition = formattedValue.length;
            } else if (newCursorPosition < 0) {
                 newCursorPosition = 0;
            }
            
            input.setSelectionRange(newCursorPosition, newCursorPosition);
        }
        
        item.totalPrice = item.quantity * item.unitPrice;
        tr.querySelector('.item-total').textContent = formatNumber(item.totalPrice);
        calculateTotals();
    };
    
    // onblur 이벤트: 수량 필드에서 포커스 이동 시 소수점 첫째 자리로 강제 조정
    document.addEventListener('blur', (e) => {
        const input = e.target;
        if (input.classList.contains('item-quantity') && input.closest('#quote-items-container')) {
            const groupIndex = parseInt(input.dataset.groupIndex);
            const itemIndex = parseInt(input.dataset.itemIndex);
            
            let rawValue = parseNumber(input.value);
            let formattedQuantity;
            if (Number.isInteger(rawValue)) {
                formattedQuantity = String(Math.round(rawValue));
            } else {
                formattedQuantity = rawValue.toFixed(1);
            }

            input.value = formattedQuantity;
            dateGroups[groupIndex].items[itemIndex].quantity = parseNumber(formattedQuantity);

            calculateTotals();
        }
    }, true);

    // VAT 라디오 버튼 변경 감지 및 재계산
    vatExclusiveRadio.addEventListener('change', calculateTotals);
    vatInclusiveRadio.addEventListener('change', calculateTotals);

    // ---------- Autocomplete UI ----------
    let currentAutocomplete = null;

    function clearAutocomplete() {
        if (currentAutocomplete && currentAutocomplete.el) {
            currentAutocomplete.el.remove();
        }
        currentAutocomplete = null;
    }

    function showAutocompleteSuggestions(inputEl, query) {
        clearAutocomplete();
        if (!query || !inputEl) return;
        const matches = findItemSetsByPartial(query, 8);
        if (!matches || matches.length === 0) return;

        const rect = inputEl.getBoundingClientRect();
        const list = document.createElement('div');
        list.className = 'autocomplete-list';
        list.style.minWidth = rect.width + 'px';
        list.style.left = (rect.left + window.pageXOffset) + 'px';
        list.style.top = (rect.bottom + window.pageYOffset) + 'px';

        matches.forEach((m, idx) => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.dataset.name = m.name || '';
            item.innerHTML = `
                <div style="flex:1">${m.name || ''}</div>
                <div style="text-align:right; min-width:120px;" class="meta">${m.spec || ''} ${m.unit ? '('+m.unit+')' : ''} ${m.unitPrice ? formatNumber(m.unitPrice) + '원' : ''}</div>
            `;
            item.onclick = (e) => {
                e.stopPropagation();
                applyAutocompleteSelection(inputEl, m);
                clearAutocomplete();
                inputEl.focus();
            };
            item.onmouseover = () => {
                list.querySelectorAll('.autocomplete-item').forEach(it => it.classList.remove('active'));
                item.classList.add('active');
            };
            list.appendChild(item);
        });

        document.body.appendChild(list);
        currentAutocomplete = { el: list, input: inputEl };
    }

    function applyAutocompleteSelection(inputEl, set) {
        if (!inputEl || !set) return;
        const tr = inputEl.closest('tr');
        if (!tr) return;
        const dateGroupDiv = tr.closest('.date-group');
        const groupIndex = parseInt(dateGroupDiv.dataset.groupIndex);
        const itemIndex = parseInt(tr.dataset.itemIndex);
        const item = dateGroups[groupIndex].items[itemIndex];

        // 품명도 자동 채움
        item.name = set.name || item.name || '';
        if (inputEl) {
            inputEl.value = item.name;
            adjustFontSize(inputEl);
        }

        // 채우기: 사용자가 선택하면 항상 해당 정보로 덮어씀
        item.spec = set.spec || '';
        const specInput = tr.querySelector('.item-spec');
        if (specInput) {
            specInput.value = item.spec;
            adjustFontSize(specInput);
        }

        item.unit = set.unit || '';
        const unitInput = tr.querySelector('.item-unit');
        if (unitInput) unitInput.value = item.unit;

        item.unitPrice = parseNumber(set.unitPrice || 0);
        const upInput = tr.querySelector('.item-unit-price');
        if (upInput) upInput.value = formatNumber(item.unitPrice);

        // increment usage metadata
        incrementItemUsage(set.name);

        // update total and UI
        item.totalPrice = (item.quantity || 0) * (item.unitPrice || 0);
        const totalCell = tr.querySelector('.item-total');
        if (totalCell) totalCell.textContent = formatNumber(item.totalPrice);
        saveData();
        render();
    }

    // close suggestions on click outside
    document.addEventListener('click', (e) => {
        const el = e.target;
        if (currentAutocomplete && currentAutocomplete.el) {
            if (!currentAutocomplete.el.contains(el) && el !== currentAutocomplete.input) {
                clearAutocomplete();
            }
        }
    });

    // keyboard handling for suggestions
    document.addEventListener('keydown', (e) => {
        const active = document.activeElement;
        if (!active || !active.classList.contains('item-name')) return;
        if (!currentAutocomplete || !currentAutocomplete.el) return;
        const items = Array.from(currentAutocomplete.el.querySelectorAll('.autocomplete-item'));
        if (items.length === 0) return;
        const idx = items.findIndex(it => it.classList.contains('active'));
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = (idx + 1) % items.length;
            items.forEach(i => i.classList.remove('active'));
            items[next].classList.add('active');
            items[next].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = (idx - 1 + items.length) % items.length;
            items.forEach(i => i.classList.remove('active'));
            items[prev].classList.add('active');
            items[prev].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            // apply selected
            if (idx >= 0) {
                e.preventDefault();
                const sel = items[idx];
                const name = sel.dataset.name;
                const sets = loadItemSets();
                const set = sets.find(s => s.name === name);
                if (set) applyAutocompleteSelection(active, set);
                clearAutocomplete();
            }
        } else if (e.key === 'Escape') {
            clearAutocomplete();
        }
    });
    
    // 메인 날짜 및 기타 input 필드 변경 시 저장
    dateInput.onchange = () => { saveData(); };
    document.getElementById('field-site').querySelector('input').onchange = () => { saveData(); };
    document.getElementById('client-name').onchange = () => { saveData(); };
    document.getElementById('client-contact').onchange = () => { saveData(); };
    document.getElementById('client-phone').onchange = () => { saveData(); };
    
    // 계좌 정보 입력 필드 변경 시 저장
    const bankNameEl = document.getElementById('bank-name');
    const bankAccountEl = document.getElementById('bank-account');
    const accountHolderEl = document.getElementById('account-holder');
    if (bankNameEl) bankNameEl.onchange = () => { saveData(); };
    if (bankAccountEl) bankAccountEl.onchange = () => { saveData(); };
    if (accountHolderEl) accountHolderEl.onchange = () => { saveData(); };

    // 초기화 버튼 기능 제거: 수동으로 초기화하려면 로컬스토리지 삭제 또는 새로고침 사용

    // -----------------------------------------------------------
    // 8. 청구서 저장/로드 (목록) 기능 추가
    // -----------------------------------------------------------
    
    // A. 현재 청구서를 목록에 저장
    const saveCurrentQuote = () => {
        // Before saving, check for empty-named rows and prompt user
        const proceedSave = handleEmptyNameRowsBeforeAction('저장');
        if (!proceedSave) return; // user cancelled

        const currentTotals = calculateTotals();
        const siteName = document.getElementById('field-site').querySelector('input').value;
        const quoteDate = dateInput.value;

        if (siteName === '현장명을 기재해주세요' || !siteName.trim()) {
            alert('저장하기 전에 현장명을 입력해주세요.');
            return;
        }

        const savedQuotes = loadSavedQuotes();
        const newQuote = {
            id: Date.now(), 
            date: quoteDate,
            siteName: siteName,
            clientName: document.getElementById('client-name').value,
            grandTotal: currentTotals.grandTotal,
            isVatInclusive: vatInclusiveRadio.checked,
            data: JSON.parse(localStorage.getItem('quoteData')),
            clientInfo: JSON.parse(localStorage.getItem('clientInfo'))
        };

        savedQuotes.unshift(newQuote); 
        localStorage.setItem('savedQuotes', JSON.stringify(savedQuotes));
        // --- 저장 시 항목 세트(itemSets)를 upsert하여 메타(usageCount, lastSaved)를 유지 ---
        try {
            // 우선적으로 메모리의 dateGroups를 사용, 없으면 로컬스토리지의 quoteData를 사용
            let sourceGroups = Array.isArray(dateGroups) && dateGroups.length ? dateGroups : (JSON.parse(localStorage.getItem('quoteData')) || []);
            sourceGroups.forEach(group => {
                if (!group || !Array.isArray(group.items)) return;
                group.items.forEach(it => {
                    const name = (it.name || '').trim();
                    if (!name) return;
                    const spec = (it.spec || '').trim();
                    const unit = (it.unit || '').trim();
                    const unitPrice = parseNumber(it.unitPrice);
                    upsertItemSet({ name, spec, unit, unitPrice });
                });
            });
        } catch (e) {
            console.error('itemSets 저장 중 오류', e);
        }
        alert(`${siteName} 청구서가 목록에 저장되었습니다.`);
    };

    // B. 목록 페이지 렌더링
    const renderQuoteList = (quotes) => {
        let currentSort = 'siteName'; // 기본 정렬: 현장명
        let isAscending = true; // 현장명은 오름차순이 기본

        // 컨테이너를 목록 모드로 전환
        containerDiv.innerHTML = '';
        containerDiv.classList.add('list-mode');
        printToolsDiv.style.display = 'none';

        // 목록 페이지 HTML 구조 생성
        const listHtml = `
            <div id="quote-list-view">
                <div class="list-header">
                    <h2>📑 청구서 저장 목록</h2>
                    <button id="new-quote-btn" class="new-quote-button">청구서 새로 만들기</button>
                </div>
                <div class="list-controls">
                    <input type="text" id="list-filter-input" placeholder="현장명, 날짜 등으로 필터링..." style="width: 250px; padding: 5px; margin-right: 10px;">
                </div>
                <table id="quote-list-table">
                    <thead>
                        <tr>
                            <th data-sort="siteName" class="sortable active ascending">현장명/수신처</th>
                            <th data-sort="date" class="sortable">작성일자 📅</th>
                            <th data-sort="grandTotal" class="sortable">청구금액 ₩</th>
                            <th>관리</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>
        `;
        containerDiv.innerHTML = listHtml;
        const tbody = document.getElementById('quote-list-table').querySelector('tbody');
        const filterInput = document.getElementById('list-filter-input');
        const newQuoteBtn = document.getElementById('new-quote-btn');

        // 새 청구서 만들기 함수
        const createNewQuote = () => {
            // 현재 작업 중인 내용 초기화
            const today = getFormattedDate(new Date());
            
            dateGroups = [{ 
                date: today, 
                items: [{ 
                    name: '', spec: '', quantity: '', unit: '', unitPrice: '', totalPrice: '', note: '', date: today 
                }] 
            }];
            
            // 로컬 스토리지 초기화 (작업 중인 데이터만)
            localStorage.setItem('quoteData', JSON.stringify(dateGroups));
            localStorage.setItem('quoteDate', today);
            localStorage.setItem('vatMode', 'exclusive');
            localStorage.setItem('clientInfo', JSON.stringify({
                site: '현장명을 기재해주세요',
                clientName: '',
                clientContact: '',
                clientPhone: '',
            }));
            localStorage.setItem('bankInfo', JSON.stringify({
                bankName: '국민은행',
                bankAccount: '123456-78-90123',
                accountHolder: '홍길동',
            }));
            
            // 페이지 새로고침으로 원래 HTML 구조 복원
            location.reload();
        };

        newQuoteBtn.onclick = createNewQuote;

        // 견적서 불러오기 함수 (재사용)
        const loadQuote = (quote) => {
            if (!quote) {
                alert('견적서를 불러올 수 없습니다.');
                return;
            }
            
            // 로컬 스토리지 업데이트
            localStorage.setItem('quoteData', JSON.stringify(quote.data));
            localStorage.setItem('quoteDate', quote.date);
            localStorage.setItem('vatMode', quote.isVatInclusive ? 'inclusive' : 'exclusive');
            localStorage.setItem('clientInfo', JSON.stringify(quote.clientInfo));

            // 페이지 새로고침으로 원래 HTML 구조 복원 및 데이터 로드
            location.reload();
        };

        // 이벤트 위임: tbody에 클릭 이벤트 연결 (한 번만, renderQuoteList 내에서)
        // 최신 quotes 배열을 항상 참조하도록 클로저 사용
        tbody.onclick = ((currentQuotes) => {
            return (e) => {
                // 항상 최신 quotes 배열 가져오기
                const latestQuotes = loadSavedQuotes();
                
                // 불러오기 버튼 클릭
                const loadBtn = e.target.closest('.load-quote-btn');
                if (loadBtn) {
                    e.stopPropagation();
                    const id = parseInt(loadBtn.dataset.id);
                    const quoteToLoad = latestQuotes.find(q => q.id === id);
                    if (quoteToLoad) {
                        loadQuote(quoteToLoad);
                    }
                    return;
                }
                
                // 삭제 버튼 클릭
                const deleteBtn = e.target.closest('.delete-quote-btn');
                if (deleteBtn) {
                    e.stopPropagation();
                    const id = parseInt(deleteBtn.dataset.id);
                    const quoteToDelete = latestQuotes.find(q => q.id === id);
                    const quoteName = quoteToDelete?.siteName || '선택된 청구서';

                    if (confirm(`"${quoteName}" 청구서를 목록에서 영구적으로 삭제하시겠습니까?`)) {
                        const updatedQuotes = latestQuotes.filter(q => q.id !== id);
                        localStorage.setItem('savedQuotes', JSON.stringify(updatedQuotes));
                        renderQuoteList(updatedQuotes);
                    }
                    return;
                }
                
                // 행 클릭 처리 (관리 버튼이 아닌 경우)
                const row = e.target.closest('.quote-list-row');
                if (row && !e.target.closest('.action-buttons') && !e.target.closest('button')) {
                    const id = parseInt(row.dataset.quoteId);
                    const quoteToLoad = latestQuotes.find(q => q.id === id);
                    if (quoteToLoad) {
                        loadQuote(quoteToLoad);
                    }
                }
            };
        })(quotes);
        
        // 테이블 본문 채우기
        const updateTable = (data) => {
            tbody.innerHTML = '';
            
            data.forEach(quote => {
                const tr = document.createElement('tr');
                tr.className = 'quote-list-row';
                tr.dataset.quoteId = quote.id;
                tr.innerHTML = `
                    <td>${quote.siteName} (${quote.clientName || '수신자 없음'})</td>
                    <td>${quote.date}</td>
                    <td class="text-right">${formatNumber(quote.grandTotal)} 원</td>
                    <td class="action-buttons">
                        <button class="load-quote-btn" data-id="${quote.id}">불러오기</button>
                        <button class="delete-quote-btn" data-id="${quote.id}">삭제</button>
                    </td>
                `;
                
                tbody.appendChild(tr);
            });
        };
        
        // 정렬 로직
        const sortData = (data, key, ascending) => {
            // 원본 배열 변경 방지를 위해 복사본 생성
            const sortedData = [...data];
            return sortedData.sort((a, b) => {
                let valA = a[key];
                let valB = b[key];

                if (key === 'date') {
                    valA = new Date(valA);
                    valB = new Date(valB);
                } else if (key === 'siteName') {
                    valA = a.siteName.toLowerCase();
                    valB = b.siteName.toLowerCase();
                } else if (key === 'grandTotal') {
                    valA = parseFloat(valA) || 0;
                    valB = parseFloat(valB) || 0;
                }

                if (valA < valB) return ascending ? -1 : 1;
                if (valA > valB) return ascending ? 1 : -1;
                return 0;
            });
        };

        // 필터링 로직
        const filterData = (data, filterText) => {
            if (!filterText) return data;
            const lowerFilter = filterText.toLowerCase();
            return data.filter(quote => 
                quote.siteName.toLowerCase().includes(lowerFilter) ||
                quote.clientName.toLowerCase().includes(lowerFilter) ||
                quote.date.includes(lowerFilter)
            );
        };
        
        // 초기 정렬 적용 (현장명 오름차순)
        let sortedAndFiltered = sortData([...quotes], currentSort, isAscending);
        updateTable(sortedAndFiltered);
        
        // 필터링 이벤트
        filterInput.oninput = (e) => {
            const filtered = filterData([...quotes], e.target.value);
            const finalData = sortData(filtered, currentSort, isAscending);
            updateTable(finalData);
        };

        // 정렬 이벤트
        document.querySelectorAll('.sortable').forEach(th => {
            th.onclick = (e) => {
                const newSort = e.target.dataset.sort;
                
                if (currentSort === newSort) {
                    isAscending = !isAscending;
                } else {
                    currentSort = newSort;
                    // 정렬 기본값 설정
                    if (newSort === 'siteName') {
                        isAscending = true; // 현장명은 오름차순
                    } else if (newSort === 'date') {
                        isAscending = false; // 작성일자는 내림차순 (최신순)
                    } else if (newSort === 'grandTotal') {
                        isAscending = false; // 청구금액은 내림차순 (큰 금액순)
                    }
                }
                
                // 클래스 업데이트
                document.querySelectorAll('.sortable').forEach(t => {
                    t.classList.remove('active', 'ascending', 'descending');
                });
                e.target.classList.add('active', isAscending ? 'ascending' : 'descending');

                const filtered = filterData([...quotes], filterInput.value);
                const finalData = sortData(filtered, currentSort, isAscending);
                updateTable(finalData);
            };
        });
        
    };

    // 저장 버튼 이벤트 연결
    if (saveQuoteBtn) {
        saveQuoteBtn.onclick = saveCurrentQuote;
    }

    // ---------- itemSets 관리 모달 ----------
    const manageItemsetsBtn = document.getElementById('manage-itemsets-btn');

    function exportItemSetsCSV() {
        const sets = loadItemSets();
        if (!sets || sets.length === 0) {
            alert('내보낼 항목이 없습니다.');
            return;
        }
        const header = ['품명','규격','단위','단가','usageCount','lastUsed','lastSaved'];
        const rows = sets.map(s => [s.name, s.spec, s.unit, s.unitPrice, s.usageCount || 0, s.lastUsed || '', s.lastSaved || '']);
        const csv = [header].concat(rows).map(r => r.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'itemSets_export.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function deleteItemSetByName(name) {
        if (!name) return;
        const sets = loadItemSets();
        const remaining = sets.filter(s => s.name && s.name.trim().toLowerCase() !== name.trim().toLowerCase());
        saveItemSets(remaining);
    }

    function renderItemSetsModal() {
        const sets = loadItemSets();
        const existing = document.getElementById('itemsets-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'itemsets-modal';
        modal.style.position = 'fixed';
        modal.style.left = 0;
        modal.style.top = 0;
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.background = 'rgba(0,0,0,0.4)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = 9999;

        const box = document.createElement('div');
        box.className = 'modal-box';
        box.innerHTML = `
            <h3>항목 관리 (itemSets)</h3>
            <p>부분일치 자동완성에 사용되는 항목 세트 목록입니다. 사용빈도와 최근 저장일로 정렬되어 표시됩니다.</p>
            <div style="margin:8px 0 12px 0; text-align:right;">
                <button id="itemsets-export-btn">내보내기(CSV)</button>
                <button id="itemsets-close-btn" style="margin-left:8px;">닫기</button>
            </div>
        `;

        const table = document.createElement('table');
        table.innerHTML = `
            <thead><tr><th>품명</th><th>규격</th><th>단위</th><th>단가</th><th>사용량</th><th>최근사용</th><th>최근저장</th><th>동작</th></tr></thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');

        // sort by usage,lastUsed,lastSaved
        sets.sort((a,b) => {
            const ua = a.usageCount||0, ub = b.usageCount||0; if (ua !== ub) return ub-ua;
            const la = a.lastUsed||0, lb = b.lastUsed||0; if (la !== lb) return lb-la;
            const sa = a.lastSaved||0, sb = b.lastSaved||0; return sb-sa;
        });

        sets.forEach(s => {
            const tr = document.createElement('tr');
            const lastUsed = s.lastUsed ? new Date(s.lastUsed).toLocaleString() : '';
            const lastSaved = s.lastSaved ? new Date(s.lastSaved).toLocaleString() : '';
            tr.innerHTML = `
                <td>${s.name}</td>
                <td>${s.spec || ''}</td>
                <td>${s.unit || ''}</td>
                <td style="text-align:right">${formatNumber(s.unitPrice)}</td>
                <td style="text-align:right">${s.usageCount || 0}</td>
                <td>${lastUsed}</td>
                <td>${lastSaved}</td>
                <td><button class="delete-itemset-btn" data-name="${s.name}">삭제</button></td>
            `;
            tbody.appendChild(tr);
        });

        box.appendChild(table);
        modal.appendChild(box);
        document.body.appendChild(modal);

        // events
        box.querySelector('#itemsets-close-btn').onclick = () => modal.remove();
        box.querySelector('#itemsets-export-btn').onclick = exportItemSetsCSV;
        box.querySelectorAll('.delete-itemset-btn').forEach(btn => {
            btn.onclick = (e) => {
                const name = e.target.dataset.name;
                if (confirm(`'${name}' 항목을 삭제하시겠습니까?`)) {
                    deleteItemSetByName(name);
                    renderItemSetsModal();
                }
            };
        });
    }

    if (manageItemsetsBtn) manageItemsetsBtn.onclick = renderItemSetsModal;


    
    // 목록 보기 버튼 이벤트 연결
    if (viewListBtn) {
        viewListBtn.onclick = () => {
            const quotes = loadSavedQuotes();
            renderQuoteList(quotes);
        };
    }

    // 출력하기 버튼 이벤트 연결
    if (printBtn) {
        printBtn.onclick = () => {
            // Before printing, check for empty-named rows and prompt user
            const proceedPrint = handleEmptyNameRowsBeforeAction('인쇄');
            if (!proceedPrint) return; // user cancelled

            // Next: check for items that have a name but are missing quantity/unit/unitPrice
            checkMissingFieldsBeforePrint((okToProceed) => {
                if (!okToProceed) return; // user chose to cancel after review

                // 각 수신자 정보 필드 확인
                const clientNameEl = document.getElementById('client-name');
                const clientContactEl = document.getElementById('client-contact');
                const clientPhoneEl = document.getElementById('client-phone');
                const recipientInfoEl = document.querySelector('.recipient-info');
                
                // 각 필드의 p 태그 가져오기
                const nameField = document.querySelector('.recipient-field[data-field="name"]');
                const contactField = document.querySelector('.recipient-field[data-field="contact"]');
                const phoneField = document.querySelector('.recipient-field[data-field="phone"]');
                
                // 입력되지 않은 필드는 인쇄 시 숨김 클래스 추가
                if (nameField) {
                    if (!clientNameEl || !clientNameEl.value.trim()) {
                        nameField.classList.add('hide-on-print');
                    } else {
                        nameField.classList.remove('hide-on-print');
                    }
                }
                
                if (contactField) {
                    if (!clientContactEl || !clientContactEl.value.trim()) {
                        contactField.classList.add('hide-on-print');
                    } else {
                        contactField.classList.remove('hide-on-print');
                    }
                }
                
                if (phoneField) {
                    if (!clientPhoneEl || !clientPhoneEl.value.trim()) {
                        phoneField.classList.add('hide-on-print');
                    } else {
                        phoneField.classList.remove('hide-on-print');
                    }
                }
                
                // 모든 필드가 비어있으면 수신자 정보 박스 전체 숨김
                const hasClientInfo = (clientNameEl && clientNameEl.value.trim()) || 
                                      (clientContactEl && clientContactEl.value.trim()) || 
                                      (clientPhoneEl && clientPhoneEl.value.trim());
                
                if (!hasClientInfo && recipientInfoEl) {
                    recipientInfoEl.classList.add('hide-on-print');
                } else if (recipientInfoEl) {
                    recipientInfoEl.classList.remove('hide-on-print');
                }
                
                // 인쇄 실행
                window.print();
                
                // 인쇄 후 클래스 제거 (다시 화면으로 돌아왔을 때)
                setTimeout(() => {
                    if (recipientInfoEl) {
                        recipientInfoEl.classList.remove('hide-on-print');
                    }
                    if (nameField) nameField.classList.remove('hide-on-print');
                    if (contactField) contactField.classList.remove('hide-on-print');
                    if (phoneField) contactField.classList.remove('hide-on-print');
                }, 100);
            });
        };
    }

    // -----------------------------------------------------------
    // 9. 초기 실행
    // -----------------------------------------------------------
    loadDateGroups(); 
    render();
});