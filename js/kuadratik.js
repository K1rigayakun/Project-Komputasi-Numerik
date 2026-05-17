/* ============================================
   KUADRATIK.JS - Interpolasi Kuadratik (Orde 2)
   Batasan: Tepat 3 titik data
   Auto-calculate dengan debounce
   PROGRESSIVE: Grafik & rumus update setiap ada data baru
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    initDefaultDisplay();

    document.getElementById('sampleBtn')?.addEventListener('click', () => {
        document.getElementById('x0').value = '1';
        document.getElementById('y0').value = '1';
        document.getElementById('x1').value = '4';
        document.getElementById('y1').value = '2';
        document.getElementById('x2').value = '6';
        document.getElementById('y2').value = '4';
        document.getElementById('xEval').value = '2';
        runCalculation();
    });

    setupAutoCalculate('#kuadratikWorkspace', runCalculation, 350);
});

function initDefaultDisplay() {
    const resultSection = document.getElementById('resultSection');
    const stepsContainer = document.getElementById('stepsContainer');
    const chartCanvas = document.getElementById('chart');
    const chartEmpty = document.getElementById('chartEmpty');

    resultSection.classList.remove('hidden');
    stepsContainer.innerHTML = buildDefaultFormula();
    renderMath(resultSection);

    if (chartCanvas) chartCanvas.style.display = 'block';
    if (chartEmpty) chartEmpty.style.display = 'none';
    initEmptyChart();
}

function buildDefaultFormula() {
    return buildProgressiveHTML(
        [NaN, NaN, NaN], [NaN, NaN, NaN], [], [], NaN
    );
}

function initEmptyChart() {
    createInterpolationChart('chart',
        { x: [0], y: [0] },
        { x: [0, 1], y: [0, 0] },
        null,
        'Grafik Interpolasi Kuadratik'
    );
}

/* --- Collect all raw values + valid point pairs --- */
function collectData() {
    const pairs = [['x0','y0'], ['x1','y1'], ['x2','y2']];
    const rawX = [], rawY = [], validX = [], validY = [];

    for (const [xId, yId] of pairs) {
        const xv = parseFloat(document.getElementById(xId).value);
        const yv = parseFloat(document.getElementById(yId).value);
        rawX.push(xv);
        // Default y=0 jika x ada tapi y kosong
        rawY.push(!isNaN(xv) && isNaN(yv) ? 0 : yv);
        if (!isNaN(xv)) {
            validX.push(xv);
            validY.push(isNaN(yv) ? 0 : yv);
        }
    }

    const xEval = parseFloat(document.getElementById('xEval').value);
    return { rawX, rawY, validX, validY, xEval };
}

function runCalculation() {
    const errorContainer = document.getElementById('errorContainer');
    clearError(errorContainer);

    const { rawX, rawY, validX, validY, xEval } = collectData();

    // Selalu update grafik dengan titik yang ada
    updateChart(validX, validY, rawX, rawY, xEval);

    // Selalu update rumus/steps secara progresif
    updateSteps(rawX, rawY, validX, validY, xEval, errorContainer);
}

function updateChart(validX, validY, rawX, rawY, xEval) {
    const chartCanvas = document.getElementById('chart');
    const chartEmpty = document.getElementById('chartEmpty');
    if (chartCanvas) chartCanvas.style.display = 'block';
    if (chartEmpty) chartEmpty.style.display = 'none';

    if (validX.length === 0) {
        initEmptyChart();
        return;
    }

    // Kalau punya 3 valid points, hitung kurva
    const allComplete = validX.length === 3;
    let curve, evalPoint = null;

    if (allComplete) {
        const b0 = validY[0];
        const b1 = (validY[1] - validY[0]) / (validX[1] - validX[0]);
        const b2 = ((validY[2] - validY[1]) / (validX[2] - validX[1]) - b1) / (validX[2] - validX[0]);
        const coefficients = [b0, b1, b2];
        const extras = !isNaN(xEval) ? [xEval] : [];
        const xMin = Math.min(...validX, ...extras) - 1;
        const xMax = Math.max(...validX, ...extras) + 1;
        curve = MathUtils.generateCurvePoints(coefficients, validX, xMin, xMax, 200);

        if (!isNaN(xEval)) {
            const result = b0 + b1 * (xEval - validX[0]) + b2 * (xEval - validX[0]) * (xEval - validX[1]);
            evalPoint = { x: xEval, y: result };
        }
    } else {
        // Belum cukup data untuk kurva, tampilkan garis flat
        const xMin = Math.min(...validX) - 2;
        const xMax = Math.max(...validX) + 2;
        curve = { x: [xMin, xMax], y: [0, 0] };
    }

    createInterpolationChart('chart',
        { x: validX, y: validY },
        curve,
        evalPoint,
        'Grafik Interpolasi Kuadratik'
    );
}

function updateSteps(rawX, rawY, validX, validY, xEval, errorContainer) {
    const resultSection = document.getElementById('resultSection');
    resultSection.classList.remove('hidden');
    const stepsContainer = document.getElementById('stepsContainer');

    const html = buildProgressiveHTML(rawX, rawY, validX, validY, xEval);
    smoothContentTransition(stepsContainer, html, () => {
        renderMath(resultSection);
    });
}

/* --- Build HTML yang progresif berdasarkan data yang tersedia --- */
function buildProgressiveHTML(rawX, rawY, validX, validY, xEval) {
    const fmt = MathUtils.fmt;
    const d = (v) => isNaN(v) ? '—' : fmt(v);
    let html = '';

    // Step 1: Rumus Umum (selalu tampil)
    html += `
    <div class="step">
        <div class="step__number">1</div>
        <div class="step__title">Rumus Umum Interpolasi Kuadratik</div>
        <div class="step__content">
            <p style="margin-bottom:12px;color:var(--text-muted);">Interpolasi kuadratik (orde-2) menggunakan 3 titik data untuk membentuk kurva parabola:</p>
            <div class="formula-box formula-box--highlight">
                <span class="formula-box__label">Rumus Umum</span>
                <div style="text-align:center;padding:8px 0;">
                    \\[ f_2(x) = b_0 + b_1(x - x_0) + b_2(x - x_0)(x - x_1) \\]
                </div>
            </div>
            <div style="margin-top:12px;">
                <p style="font-size:0.85rem;color:var(--text-muted);">Dimana koefisien dihitung menggunakan <em>divided differences</em>:</p>
                <div class="computation" style="margin-top:8px;">
                    \\( b_0 = f(x_0) \\)<br>
                    \\( b_1 = f[x_1, x_0] = \\frac{f(x_1) - f(x_0)}{x_1 - x_0} \\)<br>
                    \\( b_2 = \\frac{f[x_2, x_1] - f[x_1, x_0]}{x_2 - x_0} \\)
                </div>
            </div>
        </div>
    </div>`;

    // Step 2: Tabel Data (selalu tampil, dengan "—" untuk yang kosong)
    html += `
    <div class="step">
        <div class="step__number">2</div>
        <div class="step__title">Data yang Diketahui</div>
        <div class="step__content">
            <div class="table-wrapper" style="margin-bottom:16px;">
                <table class="table">
                    <thead>
                        <tr><th>i</th><th>\\(x_i\\)</th><th>\\(y_i\\)</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>0</td><td>${d(rawX[0])}</td><td>${d(rawY[0])}</td></tr>
                        <tr><td>1</td><td>${d(rawX[1])}</td><td>${d(rawY[1])}</td></tr>
                        <tr><td>2</td><td>${d(rawX[2])}</td><td>${d(rawY[2])}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;

    // Kalau belum ada 3 titik valid lengkap — stop disini
    const allComplete = validX.length === 3;
    if (!allComplete) {
        html += `
        <div class="step">
            <div class="step__number">3</div>
            <div class="step__title">Menunggu Data Lengkap</div>
            <div class="step__content">
                <p style="color:var(--text-muted);font-size:0.9rem;">Masukkan semua 3 pasang titik data (x, y) untuk melihat perhitungan lengkap.</p>
            </div>
        </div>`;
        return html;
    }

    // Full calculation steps
    const x = validX, y = validY;
    const b0 = y[0];
    const b1 = (y[1] - y[0]) / (x[1] - x[0]);
    const f_x1x2 = (y[2] - y[1]) / (x[2] - x[1]);
    const b2 = (f_x1x2 - b1) / (x[2] - x[0]);

    // Step 3: b0
    html += `
    <div class="step">
        <div class="step__number">3</div>
        <div class="step__title">Hitung \\( b_0 \\)</div>
        <div class="step__content">
            <div class="formula-box">
                <div style="text-align:center;">
                    \\[ b_0 = f(x_0) = f(${fmt(x[0])}) = ${fmt(b0)} \\]
                </div>
            </div>
        </div>
    </div>`;

    // Step 4: b1
    html += `
    <div class="step">
        <div class="step__number">4</div>
        <div class="step__title">Hitung \\( b_1 = f[x_1, x_0] \\)</div>
        <div class="step__content">
            <div class="formula-box">
                <span class="formula-box__label">Rumus</span>
                <div style="text-align:center;padding:4px 0;">
                    \\[ b_1 = \\frac{f(x_1) - f(x_0)}{x_1 - x_0} \\]
                </div>
            </div>
            <div class="formula-box" style="margin-top:12px;">
                <span class="formula-box__label">Substitusi</span>
                <div style="text-align:center;padding:4px 0;">
                    \\[ b_1 = \\frac{${fmt(y[1])} - ${fmt(y[0])}}{${fmt(x[1])} - ${fmt(x[0])}} = \\frac{${fmt(y[1] - y[0])}}{${fmt(x[1] - x[0])}} = ${fmt(b1)} \\]
                </div>
            </div>
        </div>
    </div>`;

    // Step 5: f[x2,x1]
    html += `
    <div class="step">
        <div class="step__number">5</div>
        <div class="step__title">Hitung \\( f[x_2, x_1] \\)</div>
        <div class="step__content">
            <div class="formula-box">
                <div style="text-align:center;padding:4px 0;">
                    \\[ f[x_2, x_1] = \\frac{f(x_2) - f(x_1)}{x_2 - x_1} = \\frac{${fmt(y[2])} - ${fmt(y[1])}}{${fmt(x[2])} - ${fmt(x[1])}} = \\frac{${fmt(y[2] - y[1])}}{${fmt(x[2] - x[1])}} = ${fmt(f_x1x2)} \\]
                </div>
            </div>
        </div>
    </div>`;

    // Step 6: b2
    html += `
    <div class="step">
        <div class="step__number">6</div>
        <div class="step__title">Hitung \\( b_2 \\)</div>
        <div class="step__content">
            <div class="formula-box">
                <span class="formula-box__label">Rumus</span>
                <div style="text-align:center;padding:4px 0;">
                    \\[ b_2 = \\frac{f[x_2, x_1] - f[x_1, x_0]}{x_2 - x_0} \\]
                </div>
            </div>
            <div class="formula-box" style="margin-top:12px;">
                <span class="formula-box__label">Substitusi</span>
                <div style="text-align:center;padding:4px 0;">
                    \\[ b_2 = \\frac{${fmt(f_x1x2)} - ${fmt(b1)}}{${fmt(x[2])} - ${fmt(x[0])}} = \\frac{${fmt(f_x1x2 - b1)}}{${fmt(x[2] - x[0])}} = ${fmt(b2)} \\]
                </div>
            </div>
        </div>
    </div>`;

    // Step 7: Polinom
    html += `
    <div class="step">
        <div class="step__number">7</div>
        <div class="step__title">Bentuk Polinom Interpolasi</div>
        <div class="step__content">
            <div class="formula-box formula-box--highlight">
                <span class="formula-box__label">Hasil</span>
                <div style="text-align:center;padding:4px 0;">
                    \\[ f_2(x) = ${fmt(b0)} + ${fmt(b1)}(x - ${fmt(x[0])}) + ${fmt(b2)}(x - ${fmt(x[0])})(x - ${fmt(x[1])}) \\]
                </div>
            </div>
        </div>
    </div>`;

    // Step 8: Evaluasi (jika xEval ada)
    if (!isNaN(xEval)) {
        const result = b0 + b1 * (xEval - x[0]) + b2 * (xEval - x[0]) * (xEval - x[1]);
        const term1 = b1 * (xEval - x[0]);
        const term2 = b2 * (xEval - x[0]) * (xEval - x[1]);

        html += `
        <div class="step">
            <div class="step__number">8</div>
            <div class="step__title">Evaluasi di \\( x = ${fmt(xEval)} \\)</div>
            <div class="step__content">
                <div class="formula-box">
                    <div style="text-align:center;padding:4px 0;">
                        \\[ f_2(${fmt(xEval)}) = ${fmt(b0)} + ${fmt(b1)}(${fmt(xEval)} - ${fmt(x[0])}) + ${fmt(b2)}(${fmt(xEval)} - ${fmt(x[0])})(${fmt(xEval)} - ${fmt(x[1])}) \\]
                        \\[ = ${fmt(b0)} + ${fmt(term1)} + ${fmt(term2)} \\]
                    </div>
                </div>
                <div class="result-box" style="margin-top:16px;">
                    <div class="result-box__label">Hasil Akhir</div>
                    <div class="result-box__value">f(${fmt(xEval)}) = ${fmt(result)}</div>
                </div>
            </div>
        </div>`;
    }

    return html;
}
