/* ============================================
   NEWTON.JS - Polinom Newton (Orde-N)
   Batasan: Minimal 2 titik, maks 20
   Auto-calculate dengan debounce
   PROGRESSIVE: Grafik & rumus update setiap ada data baru
   MORPHING: Semua transisi pakai anime.js, tidak ada refresh
   ============================================ */

let currentNumPoints = 4;

document.addEventListener('DOMContentLoaded', () => {
    generatePointInputs(currentNumPoints, true); // first render
    initDefaultDisplay();

    // Auto-update jumlah titik tanpa tombol
    const numPointsInput = document.getElementById('numPoints');
    const debouncedPointChange = debounce(() => {
        const n = parseInt(numPointsInput.value);
        if (n >= 2 && n <= 20 && n !== currentNumPoints) {
            const prevN = currentNumPoints;
            currentNumPoints = n;
            morphPointInputs(prevN, n);
            setupAutoCalculate('#newtonWorkspace', runCalculation, 350);
            runCalculation();
        }
    }, 400);
    numPointsInput?.addEventListener('input', debouncedPointChange);

    // Tetap support tombol juga
    document.getElementById('applyPointsBtn')?.addEventListener('click', () => {
        const n = parseInt(numPointsInput.value);
        if (n >= 2 && n <= 20) {
            const prevN = currentNumPoints;
            currentNumPoints = n;
            morphPointInputs(prevN, n);
            setupAutoCalculate('#newtonWorkspace', runCalculation, 350);
            runCalculation();
        }
    });

    document.getElementById('sampleBtn')?.addEventListener('click', () => {
        document.getElementById('numPoints').value = '4';
        const prevN = currentNumPoints;
        currentNumPoints = 4;
        if (prevN !== 4) {
            morphPointInputs(prevN, 4);
        }
        setupAutoCalculate('#newtonWorkspace', runCalculation, 350);

        setTimeout(() => {
            const sampleX = [1, 4, 6, 5];
            const sampleY = [1, 2, 4, 3];
            for (let i = 0; i < 4; i++) {
                document.getElementById(`x${i}`).value = sampleX[i];
                document.getElementById(`y${i}`).value = sampleY[i];
            }
            document.getElementById('xEval').value = '2';
            runCalculation();
        }, 100);
    });

    setupAutoCalculate('#newtonWorkspace', runCalculation, 350);
});

const SUBSCRIPTS = ['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉','₁₀','₁₁','₁₂','₁₃','₁₄','₁₅','₁₆','₁₇','₁₈','₁₉'];

function buildPointRowHTML(i) {
    const sub = SUBSCRIPTS[i] || `_${i}`;
    return `
    <div class="point-row" data-point-index="${i}">
        <span class="point-row__label">P${sub}</span>
        <div class="form-group"><label class="form-label" for="x${i}">x${sub}</label><input type="number" class="form-input" id="x${i}" step="any" value="0"></div>
        <div class="form-group"><label class="form-label" for="y${i}">y${sub}</label><input type="number" class="form-input" id="y${i}" step="any" value="0"></div>
        <div style="width:32px;"></div>
    </div>`;
}

/* --- First time: generate all rows (used only on page load) --- */
function generatePointInputs(n, isFirstRender = false) {
    const container = document.getElementById('pointsContainer');
    let html = '';
    for (let i = 0; i < n; i++) {
        html += buildPointRowHTML(i);
    }
    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

/* --- MORPH point inputs: slide-in new rows, collapse removed rows --- */
function morphPointInputs(prevN, newN) {
    const container = document.getElementById('pointsContainer');
    const existingRows = Array.from(container.querySelectorAll('.point-row'));
    const useAnime = typeof _animate !== 'undefined';

    if (newN > prevN) {
        // ADD new rows at the bottom with slide-in animation
        for (let i = prevN; i < newN; i++) {
            const temp = document.createElement('div');
            temp.innerHTML = buildPointRowHTML(i);
            const newRow = temp.firstElementChild;

            if (useAnime) {
                newRow.style.opacity = '0';
                newRow.style.transform = 'translateY(20px) scale(0.97)';
                newRow.style.overflow = 'hidden';
            }

            container.appendChild(newRow);

            if (useAnime) {
                _animate(newRow, {
                    translateY: [20, 0],
                    scale: [0.97, 1],
                    opacity: [0, 1],
                    duration: 400,
                    ease: 'outCubic',
                    delay: (i - prevN) * 50,
                    onComplete: () => {
                        newRow.style.transform = '';
                        newRow.style.opacity = '';
                        newRow.style.overflow = '';
                    }
                });
            }
        }
    } else if (newN < prevN) {
        // REMOVE excess rows from bottom with collapse animation
        const rowsToRemove = existingRows.slice(newN);
        rowsToRemove.forEach((row, idx) => {
            if (useAnime) {
                const h = row.offsetHeight;
                row.style.overflow = 'hidden';
                row.style.maxHeight = h + 'px';

                _animate(row, {
                    translateY: [0, -10],
                    opacity: [1, 0],
                    maxHeight: [h, 0],
                    marginBottom: [undefined, 0],
                    paddingTop: [undefined, 0],
                    paddingBottom: [undefined, 0],
                    duration: 300,
                    ease: 'inCubic',
                    delay: idx * 30,
                    onComplete: () => {
                        row.remove();
                    }
                });
            } else {
                row.remove();
            }
        });
    }

    if (window.lucide) lucide.createIcons();
}

function initDefaultDisplay() {
    const resultSection = document.getElementById('resultSection');
    const stepsContainer = document.getElementById('stepsContainer');
    const chartCanvas = document.getElementById('chart');
    const chartEmpty = document.getElementById('chartEmpty');

    resultSection.classList.remove('hidden');

    const rawX = new Array(currentNumPoints).fill(NaN);
    const rawY = new Array(currentNumPoints).fill(NaN);
    stepsContainer.innerHTML = buildProgressiveHTML(rawX, rawY, [], [], NaN);
    renderMath(resultSection);

    if (chartCanvas) chartCanvas.style.display = 'block';
    if (chartEmpty) chartEmpty.style.display = 'none';
    initEmptyChart();
}

function initEmptyChart() {
    createInterpolationChart('chart',
        { x: [0], y: [0] },
        { x: [0, 1], y: [0, 0] },
        null,
        'Grafik Polinom Newton'
    );
}

function collectData() {
    const n = currentNumPoints;
    const rawX = [], rawY = [], validX = [], validY = [];

    for (let i = 0; i < n; i++) {
        const xEl = document.getElementById(`x${i}`);
        const yEl = document.getElementById(`y${i}`);
        const xStr = xEl?.value?.trim() ?? '';
        const yStr = yEl?.value?.trim() ?? '';
        // Jika kosong, default 0
        const xv = xStr === '' ? 0 : parseFloat(xStr);
        const yv = yStr === '' ? 0 : parseFloat(yStr);
        rawX.push(isNaN(xv) ? 0 : xv);
        rawY.push(isNaN(yv) ? 0 : yv);
        // Semua titik valid karena default 0
        const finalX = isNaN(xv) ? 0 : xv;
        const finalY = isNaN(yv) ? 0 : yv;
        validX.push(finalX);
        validY.push(finalY);
    }

    // Deduplikasi x — cegah division by zero di DD table
    const seen = new Set();
    const dedupX = [], dedupY = [];
    for (let i = 0; i < validX.length; i++) {
        if (!seen.has(validX[i])) {
            seen.add(validX[i]);
            dedupX.push(validX[i]);
            dedupY.push(validY[i]);
        }
    }

    const xEval = parseFloat(document.getElementById('xEval').value);
    return { rawX, rawY, validX: dedupX, validY: dedupY, xEval };
}

function buildDDTable(x, y) {
    const n = x.length;
    const dd = [];
    for (let i = 0; i < n; i++) {
        dd[i] = [y[i]];
    }
    for (let j = 1; j < n; j++) {
        for (let i = 0; i < n - j; i++) {
            dd[i][j] = (dd[i + 1][j - 1] - dd[i][j - 1]) / (x[i + j] - x[i]);
        }
    }
    return dd;
}

function runCalculation() {
    const errorContainer = document.getElementById('errorContainer');
    clearError(errorContainer);

    const { rawX, rawY, validX, validY, xEval } = collectData();

    // Update grafik progresif
    updateChart(validX, validY, xEval);

    // Update steps/rumus progresif
    const resultSection = document.getElementById('resultSection');
    resultSection.classList.remove('hidden');
    const stepsContainer = document.getElementById('stepsContainer');
    const html = buildProgressiveHTML(rawX, rawY, validX, validY, xEval);
    smoothContentTransition(stepsContainer, html, () => {
        renderMath(resultSection);
    });
}

function updateChart(validX, validY, xEval) {
    const chartCanvas = document.getElementById('chart');
    const chartEmpty = document.getElementById('chartEmpty');
    if (chartCanvas) chartCanvas.style.display = 'block';
    if (chartEmpty) chartEmpty.style.display = 'none';

    if (validX.length === 0) {
        initEmptyChart();
        return;
    }

    const allComplete = validX.length >= 2;
    let curve, evalPoint = null;

    if (allComplete) {
        try {
            const ddTable = buildDDTable(validX, validY);
            const coeffs = ddTable[0];

            // Cek apakah koefisien mengandung NaN/Infinity
            const hasInvalidCoeff = coeffs.some(c => !isFinite(c));
            if (hasInvalidCoeff) {
                // Fallback: plot titik saja tanpa kurva
                const xMin = Math.min(...validX) - 2;
                const xMax = Math.max(...validX) + 2;
                curve = { x: [xMin, xMax], y: [validY[0], validY[validY.length - 1]] };
            } else {
                const extras = !isNaN(xEval) ? [xEval] : [];
                const xMin = Math.min(...validX, ...extras) - 1;
                const xMax = Math.max(...validX, ...extras) + 1;
                const rawCurve = MathUtils.generateCurvePoints(coeffs, validX, xMin, xMax, 300);

                // Filter NaN/Infinity dari curve points + clamp extreme values
                const dataYMin = Math.min(...validY);
                const dataYMax = Math.max(...validY);
                const yRange = Math.max(Math.abs(dataYMax - dataYMin), 1);
                const clampLimit = yRange * 50; // Batas clamp: 50x range data
                const yClampMin = dataYMin - clampLimit;
                const yClampMax = dataYMax + clampLimit;

                const filteredX = [], filteredY = [];
                for (let i = 0; i < rawCurve.x.length; i++) {
                    const cx = rawCurve.x[i];
                    let cy = rawCurve.y[i];
                    if (!isFinite(cx) || !isFinite(cy)) continue;
                    // Clamp extreme values agar chart tidak pecah
                    cy = Math.max(yClampMin, Math.min(yClampMax, cy));
                    filteredX.push(cx);
                    filteredY.push(cy);
                }

                curve = { x: filteredX, y: filteredY };
            }

            if (!isNaN(xEval) && !coeffs.some(c => !isFinite(c))) {
                let result = coeffs[0], product = 1;
                for (let i = 1; i < validX.length; i++) {
                    product *= (xEval - validX[i - 1]);
                    result += coeffs[i] * product;
                }
                if (isFinite(result)) {
                    evalPoint = { x: xEval, y: result };
                }
            }
        } catch (e) {
            console.warn('Newton chart error:', e);
            const xMin = Math.min(...validX) - 2;
            const xMax = Math.max(...validX) + 2;
            curve = { x: [xMin, xMax], y: [0, 0] };
        }
    } else {
        // Hanya 1 titik — plot titik saja, garis horizontal
        const xMin = Math.min(...validX) - 2;
        const xMax = Math.max(...validX) + 2;
        curve = { x: [xMin, xMax], y: [validY[0], validY[0]] };
    }

    createInterpolationChart('chart',
        { x: validX, y: validY },
        curve,
        evalPoint,
        'Grafik Polinom Newton'
    );
}

function buildProgressiveHTML(rawX, rawY, validX, validY, xEval) {
    const fmt = MathUtils.fmt;
    const d = (v) => isNaN(v) ? '—' : fmt(v);
    const n = currentNumPoints;
    let html = '';

    /* ──────── Step 1: Rumus Umum ──────── */
    html += `
    <div class="step">
        <div class="step__number">1</div>
        <div class="step__title">Rumus Umum Polinom Newton</div>
        <div class="step__content">
            <p style="margin-bottom:12px;color:var(--text-muted);">Polinom interpolasi Newton orde-\\(${n - 1}\\) menggunakan \\(${n}\\) titik data:</p>
            <div class="formula-box formula-box--highlight">
                <span class="formula-box__label">Rumus Umum</span>
                <div style="text-align:center;padding:8px 0;">
                    \\[ P_{n-1}(x) = b_0 + b_1(x - x_0) + b_2(x - x_0)(x - x_1) + \\cdots + b_{n-1}\\prod_{j=0}^{n-2}(x - x_j) \\]
                </div>
            </div>
            <div class="formula-box" style="margin-top:12px;">
                <span class="formula-box__label">Rumus Divided Difference</span>
                <div style="text-align:center;padding:8px 0;">
                    \\[ f[x_i] = y_i \\]
                    \\[ f[x_i, x_{i+1}, \\ldots, x_{i+k}] = \\frac{f[x_{i+1}, \\ldots, x_{i+k}] - f[x_i, \\ldots, x_{i+k-1}]}{x_{i+k} - x_i} \\]
                </div>
            </div>
            <div class="computation" style="margin-top:12px;">
                <p style="font-size:0.85rem;color:var(--text-muted);">Koefisien \\(b_i = f[x_0, x_1, \\ldots, x_i]\\) diambil dari baris pertama (diagonal utama) tabel divided differences.</p>
            </div>
        </div>
    </div>`;

    /* ──────── Step 2: Tabel Data ──────── */
    let tableRows = '';
    for (let i = 0; i < n; i++) {
        tableRows += `<tr><td>${i}</td><td>${d(rawX[i])}</td><td>${d(rawY[i])}</td></tr>`;
    }
    html += `
    <div class="step">
        <div class="step__number">2</div>
        <div class="step__title">Data yang Diketahui (${n} Titik)</div>
        <div class="step__content">
            <div class="table-wrapper">
                <table class="table">
                    <thead><tr><th>i</th><th>\\(x_i\\)</th><th>\\(y_i = f(x_i)\\)</th></tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
            <div class="computation" style="margin-top:10px;">
                <p style="font-size:0.85rem;color:var(--text-muted);">Divided difference orde-0: \\( f[x_i] = y_i \\), sehingga \\( b_0 = f[x_0] = ${d(rawY[0])} \\)</p>
            </div>
        </div>
    </div>`;

    if (validX.length < 2) {
        html += `
        <div class="step">
            <div class="step__number">3</div>
            <div class="step__title">Menunggu Data</div>
            <div class="step__content">
                <p style="color:var(--text-muted);font-size:0.9rem;">Masukkan minimal 2 pasang titik data (x, y) untuk melihat perhitungan. (${validX.length}/${n} titik terisi)</p>
            </div>
        </div>`;
        return html;
    }

    /* ===== FULL CALCULATION ===== */
    const x = validX, y = validY;
    const vn = x.length;
    const ddTable = buildDDTable(x, y);
    const coeffs = ddTable[0];

    /* ──────── Step 3+: Divided Differences per Orde (DETAIL) ──────── */
    for (let order = 1; order < vn; order++) {
        let ddHtml = '';
        ddHtml += `<p style="margin-bottom:10px;color:var(--text-muted);font-size:0.88rem;">Rumus orde-${order}:</p>`;
        if (order === 1) {
            ddHtml += `<div class="formula-box" style="margin-bottom:14px;"><div style="text-align:center;padding:6px 0;">\\[ f[x_i, x_{i+1}] = \\frac{f[x_{i+1}] - f[x_i]}{x_{i+1} - x_i} = \\frac{y_{i+1} - y_i}{x_{i+1} - x_i} \\]</div></div>`;
        } else {
            const idxLow = Array.from({length: order}, (_, k) => `x_{i+${k}}`).join(', ');
            const idxHigh = Array.from({length: order}, (_, k) => `x_{i+${k+1}}`).join(', ');
            const idxFull = Array.from({length: order + 1}, (_, k) => `x_{i+${k}}`).join(', ');
            ddHtml += `<div class="formula-box" style="margin-bottom:14px;"><div style="text-align:center;padding:6px 0;">\\[ f[${idxFull}] = \\frac{f[${idxHigh}] - f[${idxLow}]}{x_{i+${order}} - x_i} \\]</div></div>`;
        }

        ddHtml += `<p style="margin-bottom:8px;color:var(--text-muted);font-size:0.88rem;">Perhitungan:</p>`;

        for (let i = 0; i < vn - order; i++) {
            const idxArr = Array.from({length: order + 1}, (_, k) => i + k);
            const label = idxArr.map(k => `x_{${k}}`).join(', ');
            const numerator1 = ddTable[i + 1][order - 1];
            const numerator2 = ddTable[i][order - 1];
            const denominator = x[i + order] - x[i];
            const result = ddTable[i][order];

            const prevLabel1 = Array.from({length: order}, (_, k) => `x_{${i+1+k}}`).join(', ');
            const prevLabel2 = Array.from({length: order}, (_, k) => `x_{${i+k}}`).join(', ');

            ddHtml += `<div class="computation" style="margin-bottom:14px;padding:14px 16px;border-left:3px solid var(--primary);border-radius:6px;background:var(--surface-alt, rgba(99,102,241,0.04));">`;
            ddHtml += `<div style="text-align:center;">`;
            ddHtml += `\\[ f[${label}] = \\frac{f[${prevLabel1}] - f[${prevLabel2}]}{x_{${i+order}} - x_{${i}}} \\]`;
            ddHtml += `\\[ = \\frac{${fmt(numerator1)} - ${fmt(numerator2)}}{${fmt(x[i+order])} - ${fmt(x[i])}} \\]`;
            ddHtml += `\\[ = \\frac{${fmt(numerator1 - numerator2)}}{${fmt(denominator)}} \\]`;
            ddHtml += `\\[ = ${fmt(result)} \\]`;
            ddHtml += `</div></div>`;
        }

        html += `
        <div class="step">
            <div class="step__number">${2 + order}</div>
            <div class="step__title">Divided Differences Orde-${order}</div>
            <div class="step__content">
                ${ddHtml}
                <div class="formula-box formula-box--highlight" style="margin-top:12px;">
                    <span class="formula-box__label">Koefisien \\(b_{${order}}\\)</span>
                    <div style="text-align:center;padding:6px 0;">\\[ b_{${order}} = f[${Array.from({length: order + 1}, (_, k) => `x_{${k}}`).join(', ')}] = ${fmt(coeffs[order])} \\]</div>
                </div>
            </div>
        </div>`;
    }

    const stepAfterDD = 2 + vn;

    /* ──────── Tabel DD Lengkap ──────── */
    html += `
    <div class="step">
        <div class="step__number">${stepAfterDD}</div>
        <div class="step__title">Tabel Divided Differences Lengkap</div>
        <div class="step__content">
            <div class="table-wrapper" style="overflow-x:auto;">
                <table class="table">
                    <thead>
                        <tr>
                            <th>\\(x_i\\)</th><th>\\(f[x_i]\\)</th>
                            ${Array.from({length: vn - 1}, (_, k) => `<th>Orde ${k + 1}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${x.map((xi, i) => {
                            let cols = `<td>${fmt(xi)}</td><td>${fmt(y[i])}</td>`;
                            for (let j = 1; j < vn; j++) {
                                if (i <= vn - 1 - j) {
                                    const highlightStyle = (i === 0) ? ' style="font-weight:700;color:var(--primary);"' : '';
                                    cols += `<td${highlightStyle}>${fmt(ddTable[i][j])}</td>`;
                                } else {
                                    cols += `<td></td>`;
                                }
                            }
                            return `<tr>${cols}</tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="computation" style="margin-top:10px;">
                <p style="font-size:0.85rem;color:var(--text-muted);">Koefisien \\(b_i\\) diambil dari <strong>baris pertama</strong> (dicetak tebal): ${coeffs.map((c, i) => `\\(b_{${i}} = ${fmt(c)}\\)`).join(', ')}</p>
            </div>
        </div>
    </div>`;

    /* ──────── Koefisien Ringkasan ──────── */
    let coeffDetailHtml = '';
    for (let i = 0; i < vn; i++) {
        const ddLabel = Array.from({length: i + 1}, (_, k) => `x_{${k}}`).join(', ');
        if (i === 0) {
            coeffDetailHtml += `<div class="computation" style="margin-bottom:8px;padding:8px 14px;border-left:3px solid var(--primary);border-radius:6px;background:var(--surface-alt, rgba(99,102,241,0.04));">`;
            coeffDetailHtml += `<div style="text-align:center;">`;
            coeffDetailHtml += `\\[ b_0 = f[x_0] = y_0 = ${fmt(coeffs[0])} \\]`;
            coeffDetailHtml += `</div></div>`;
        } else {
            const prevIndices = Array.from({length: i + 1}, (_, k) => fmt(x[k])).join(', ');
            coeffDetailHtml += `<div class="computation" style="margin-bottom:8px;padding:8px 14px;border-left:3px solid var(--primary);border-radius:6px;background:var(--surface-alt, rgba(99,102,241,0.04));">`;
            coeffDetailHtml += `<div style="text-align:center;">`;
            coeffDetailHtml += `\\[ b_{${i}} = f[${ddLabel}] = f[${prevIndices}] = ${fmt(coeffs[i])} \\]`;
            coeffDetailHtml += `</div></div>`;
        }
    }

    html += `
    <div class="step">
        <div class="step__number">${stepAfterDD + 1}</div>
        <div class="step__title">Koefisien Polinom (Diagonal Utama)</div>
        <div class="step__content">
            <p style="margin-bottom:10px;color:var(--text-muted);font-size:0.88rem;">Koefisien \\(b_i\\) diambil dari diagonal utama tabel (baris pertama setiap orde):</p>
            ${coeffDetailHtml}
            <div class="formula-box formula-box--highlight" style="margin-top:14px;">
                <span class="formula-box__label">Ringkasan Koefisien</span>
                <div style="text-align:center;padding:10px 0;">
                    \\[ ${coeffs.map((c, i) => `b_{${i}} = ${fmt(c)}`).join(' \\;,\\;\\; ')} \\]
                </div>
            </div>
        </div>
    </div>`;

    /* ──────── Pembentukan Polinom ──────── */
    let polyTerms = [`${fmt(coeffs[0])}`];
    for (let i = 1; i < vn; i++) {
        let prodParts = '';
        for (let j = 0; j < i; j++) {
            prodParts += `(x - ${fmt(x[j])})`;
        }
        const sign = coeffs[i] >= 0 ? '+' : '-';
        polyTerms.push(`${sign} ${fmt(Math.abs(coeffs[i]))} ${prodParts}`);
    }

    let polyBuildSteps = '';
    polyBuildSteps += `<div class="computation" style="margin-bottom:12px;padding:10px 14px;border-radius:6px;background:var(--surface-alt, rgba(99,102,241,0.04));">`;
    polyBuildSteps += `<p style="margin-bottom:8px;color:var(--text-muted);font-size:0.88rem;">Substitusi koefisien ke rumus umum:</p>`;
    polyBuildSteps += `<div style="text-align:center;">`;
    polyBuildSteps += `\\[ P_{${vn-1}}(x) = b_0 `;
    for (let i = 1; i < vn; i++) {
        let prod = '';
        for (let j = 0; j < i; j++) prod += `(x - x_{${j}})`;
        polyBuildSteps += `+ b_{${i}} ${prod} `;
    }
    polyBuildSteps += `\\]`;
    polyBuildSteps += `\\[ P_{${vn-1}}(x) = ${polyTerms.join(' ')} \\]`;
    polyBuildSteps += `</div></div>`;

    html += `
    <div class="step">
        <div class="step__number">${stepAfterDD + 2}</div>
        <div class="step__title">Pembentukan Polinom Newton</div>
        <div class="step__content">
            ${polyBuildSteps}
            <div class="formula-box formula-box--highlight" style="margin-top:12px;">
                <span class="formula-box__label">Polinom Akhir</span>
                <div style="text-align:center;padding:8px 0;">
                    \\[ P_{${vn-1}}(x) = ${polyTerms.join(' ')} \\]
                </div>
            </div>
        </div>
    </div>`;

    /* ──────── Evaluasi ──────── */
    if (!isNaN(xEval)) {
        let runProduct = 1;
        const termValues = [coeffs[0]];
        const termDetails = [];

        termDetails.push({
            label: `b_0`,
            expr: `${fmt(coeffs[0])}`,
            value: coeffs[0]
        });

        for (let i = 1; i < vn; i++) {
            runProduct *= (xEval - x[i - 1]);
            const termVal = coeffs[i] * runProduct;
            termValues.push(termVal);

            let prodExpr = '';
            let prodCalc = '';
            let prodResult = 1;
            for (let j = 0; j < i; j++) {
                prodExpr += `(${fmt(xEval)} - ${fmt(x[j])})`;
                prodResult *= (xEval - x[j]);
            }
            prodCalc = fmt(prodResult);

            termDetails.push({
                label: `b_{${i}} \\cdot \\prod`,
                coeffLabel: `b_{${i}}`,
                coeff: coeffs[i],
                prodExpr: prodExpr,
                prodVal: prodResult,
                value: termVal
            });
        }

        const result = termValues.reduce((a, b) => a + b, 0);

        let evalHtml = '';
        evalHtml += `<p style="margin-bottom:10px;color:var(--text-muted);font-size:0.88rem;">Hitung setiap suku secara terpisah:</p>`;

        for (let i = 0; i < termDetails.length; i++) {
            const td = termDetails[i];
            evalHtml += `<div class="computation" style="margin-bottom:10px;padding:10px 14px;border-left:3px solid var(--primary);border-radius:6px;background:var(--surface-alt, rgba(99,102,241,0.04));">`;
            evalHtml += `<div style="text-align:center;">`;
            if (i === 0) {
                evalHtml += `\\[ \\text{Suku ke-1} = b_0 = ${fmt(td.value)} \\]`;
            } else {
                evalHtml += `\\[ \\text{Suku ke-${i+1}} = ${td.coeffLabel} \\times ${td.prodExpr} \\]`;
                evalHtml += `\\[ = ${fmt(td.coeff)} \\times ${fmt(td.prodVal)} \\]`;
                evalHtml += `\\[ = ${fmt(td.value)} \\]`;
            }
            evalHtml += `</div></div>`;
        }

        evalHtml += `<div class="formula-box" style="margin-top:14px;">`;
        evalHtml += `<span class="formula-box__label">Penjumlahan</span>`;
        evalHtml += `<div style="text-align:center;padding:8px 0;">`;
        evalHtml += `\\[ P_{${vn-1}}(${fmt(xEval)}) = ${termValues.map(t => fmt(t)).join(' + ')} \\]`;
        evalHtml += `\\[ = ${fmt(result)} \\]`;
        evalHtml += `</div></div>`;

        html += `
        <div class="step">
            <div class="step__number">${stepAfterDD + 3}</div>
            <div class="step__title">Evaluasi di \\( x = ${fmt(xEval)} \\)</div>
            <div class="step__content">
                ${evalHtml}
                <div class="result-box" style="margin-top:16px;">
                    <div class="result-box__label">Hasil Akhir</div>
                    <div class="result-box__value">\\( P_{${vn-1}}(${fmt(xEval)}) = ${fmt(result)} \\)</div>
                </div>
            </div>
        </div>`;
    }

    return html;
}
