/* ============================================
   LANJAR.JS - Interpolasi Lanjar (Linear)
   Batasan: Tepat 2 titik data
   Auto-calculate dengan debounce
   PROGRESSIVE: Grafik update setiap ada data baru
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    initDefaultDisplay();

    document.getElementById('sampleBtn')?.addEventListener('click', () => {
        document.getElementById('x0').value = '1';
        document.getElementById('y0').value = '1';
        document.getElementById('x1').value = '4';
        document.getElementById('y1').value = '2';
        document.getElementById('xEval').value = '2';
        runCalculation();
    });

    setupAutoCalculate('#lanjarWorkspace', runCalculation, 350);
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
    return `
    <div class="step">
        <div class="step__number">1</div>
        <div class="step__title">Rumus Umum Interpolasi Lanjar</div>
        <div class="step__content">
            <p style="margin-bottom:12px;color:var(--text-muted);">Interpolasi lanjar (linear) menggunakan 2 titik data untuk membentuk garis lurus:</p>
            <div class="formula-box formula-box--highlight">
                <span class="formula-box__label">Rumus Umum</span>
                <div style="text-align:center;padding:8px 0;">
                    \\[ f_1(x) = b_0 + b_1(x - x_0) \\]
                </div>
            </div>
            <div style="margin-top:12px;">
                <p style="font-size:0.85rem;color:var(--text-muted);">Dimana:</p>
                <div class="computation" style="margin-top:8px;">
                    \\( b_0 = f(x_0) \\)<br>
                    \\( b_1 = \\frac{f(x_1) - f(x_0)}{x_1 - x_0} \\)
                </div>
            </div>
        </div>
    </div>
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
                        <tr><td>0</td><td>—</td><td>—</td></tr>
                        <tr><td>1</td><td>—</td><td>—</td></tr>
                    </tbody>
                </table>
            </div>
            <p style="font-size:0.85rem;color:var(--text-muted);">Masukkan data titik di panel input untuk melihat langkah pengerjaan lengkap.</p>
        </div>
    </div>`;
}

function initEmptyChart() {
    createInterpolationChart('chart',
        { x: [0], y: [0] },
        { x: [0, 1], y: [0, 0] },
        null,
        'Grafik Interpolasi Lanjar'
    );
}

/* --- Collect valid point pairs from current input --- */
function collectValidPoints() {
    const ids = [['x0','y0'], ['x1','y1']];
    const validX = [], validY = [];
    const rawX = [], rawY = [];

    for (const [xId, yId] of ids) {
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
    return { validX, validY, rawX, rawY, xEval };
}

function runCalculation() {
    const errorContainer = document.getElementById('errorContainer');
    clearError(errorContainer);

    const { validX, validY, rawX, rawY, xEval } = collectValidPoints();

    // Tidak ada data sama sekali — tampilkan default
    if (validX.length === 0) {
        showDefaultState();
        return;
    }

    // Ada 1 titik saja — plot titik itu di grafik + update tabel
    if (validX.length === 1) {
        showPartialData(validX, validY, rawX, rawY);
        return;
    }

    // Ada 2 titik — cek duplikat x
    const validation = MathUtils.validatePoints(validX, validY, 2);
    if (!validation.valid) {
        showError(errorContainer, validation.errors);
        showPartialData(validX, validY, rawX, rawY);
        return;
    }

    if (isNaN(xEval)) {
        showChartOnly(validX, validY);
        return;
    }

    calculate(validX, validY, xEval);
}

/* --- Tampil grafik dengan data parsial (1 titik) --- */
function showPartialData(validX, validY, rawX, rawY) {
    const chartCanvas = document.getElementById('chart');
    const chartEmpty = document.getElementById('chartEmpty');
    if (chartCanvas) chartCanvas.style.display = 'block';
    if (chartEmpty) chartEmpty.style.display = 'none';

    // Plot titik yang ada di grafik
    const xMin = Math.min(...validX) - 2;
    const xMax = Math.max(...validX) + 2;
    createInterpolationChart('chart',
        { x: validX, y: validY },
        { x: [xMin, xMax], y: [0, 0] }, // garis kosong
        null,
        'Grafik Interpolasi Lanjar'
    );

    // Update tabel dengan data yang ada
    const resultSection = document.getElementById('resultSection');
    resultSection.classList.remove('hidden');
    const fmt = MathUtils.fmt;

    const x0str = isNaN(rawX[0]) ? '—' : fmt(rawX[0]);
    const y0str = isNaN(rawY[0]) ? '—' : fmt(rawY[0]);
    const x1str = isNaN(rawX[1]) ? '—' : fmt(rawX[1]);
    const y1str = isNaN(rawY[1]) ? '—' : fmt(rawY[1]);

    let html = `
    <div class="step">
        <div class="step__number">1</div>
        <div class="step__title">Rumus Umum Interpolasi Lanjar</div>
        <div class="step__content">
            <p style="margin-bottom:12px;color:var(--text-muted);">Interpolasi lanjar (linear) menggunakan 2 titik data untuk membentuk garis lurus:</p>
            <div class="formula-box formula-box--highlight">
                <span class="formula-box__label">Rumus Umum</span>
                <div style="text-align:center;padding:8px 0;">
                    \\[ f_1(x) = b_0 + b_1(x - x_0) \\]
                </div>
            </div>
            <div style="margin-top:12px;">
                <p style="font-size:0.85rem;color:var(--text-muted);">Dimana:</p>
                <div class="computation" style="margin-top:8px;">
                    \\( b_0 = f(x_0) \\)<br>
                    \\( b_1 = \\frac{f(x_1) - f(x_0)}{x_1 - x_0} \\)
                </div>
            </div>
        </div>
    </div>
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
                        <tr><td>0</td><td>${x0str}</td><td>${y0str}</td></tr>
                        <tr><td>1</td><td>${x1str}</td><td>${y1str}</td></tr>
                    </tbody>
                </table>
            </div>
            <p style="font-size:0.85rem;color:var(--text-muted);">Masukkan semua data titik untuk melihat langkah pengerjaan lengkap.</p>
        </div>
    </div>`;

    const stepsContainer = document.getElementById('stepsContainer');
    smoothContentTransition(stepsContainer, html, () => {
        renderMath(resultSection);
    });
}

function showDefaultState() {
    const stepsContainer = document.getElementById('stepsContainer');
    const resultSection = document.getElementById('resultSection');
    resultSection.classList.remove('hidden');
    smoothContentTransition(stepsContainer, buildDefaultFormula(), () => {
        renderMath(resultSection);
    });
    initEmptyChart();
}

function showChartOnly(x, y) {
    const chartCanvas = document.getElementById('chart');
    const chartEmpty = document.getElementById('chartEmpty');

    if (chartCanvas) chartCanvas.style.display = 'block';
    if (chartEmpty) chartEmpty.style.display = 'none';

    const b0 = y[0];
    const b1 = (y[1] - y[0]) / (x[1] - x[0]);
    const coefficients = [b0, b1];
    const xMin = Math.min(...x) - 1;
    const xMax = Math.max(...x) + 1;
    const curve = MathUtils.generateCurvePoints(coefficients, x, xMin, xMax, 200);

    createInterpolationChart('chart',
        { x, y },
        curve,
        null,
        'Grafik Interpolasi Lanjar'
    );

    const resultSection = document.getElementById('resultSection');
    resultSection.classList.remove('hidden');
    const fmt = MathUtils.fmt;

    const html = buildPartialSteps(x, y, b0, b1, fmt);
    const stepsContainer = document.getElementById('stepsContainer');
    smoothContentTransition(stepsContainer, html, () => {
        renderMath(resultSection);
    });
}

function buildPartialSteps(x, y, b0, b1, fmt) {
    let html = '';

    html += `
    <div class="step">
        <div class="step__number">1</div>
        <div class="step__title">Rumus Umum Interpolasi Lanjar</div>
        <div class="step__content">
            <p style="margin-bottom:12px;color:var(--text-muted);">Interpolasi lanjar (linear) menggunakan 2 titik data untuk membentuk garis lurus:</p>
            <div class="formula-box formula-box--highlight">
                <span class="formula-box__label">Rumus Umum</span>
                <div style="text-align:center;padding:8px 0;">
                    \\[ f_1(x) = b_0 + b_1(x - x_0) \\]
                </div>
            </div>
            <div style="margin-top:12px;">
                <p style="font-size:0.85rem;color:var(--text-muted);">Dimana:</p>
                <div class="computation" style="margin-top:8px;">
                    \\( b_0 = f(x_0) \\)<br>
                    \\( b_1 = \\frac{f(x_1) - f(x_0)}{x_1 - x_0} \\)
                </div>
            </div>
        </div>
    </div>`;

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
                        <tr><td>0</td><td>${fmt(x[0])}</td><td>${fmt(y[0])}</td></tr>
                        <tr><td>1</td><td>${fmt(x[1])}</td><td>${fmt(y[1])}</td></tr>
                    </tbody>
                </table>
            </div>
            <p style="font-size:0.85rem;color:var(--text-muted);">Masukkan nilai x yang dicari untuk melihat evaluasi lengkap.</p>
        </div>
    </div>`;

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

    html += `
    <div class="step">
        <div class="step__number">4</div>
        <div class="step__title">Hitung \\( b_1 \\)</div>
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

    html += `
    <div class="step">
        <div class="step__number">5</div>
        <div class="step__title">Bentuk Polinom Interpolasi</div>
        <div class="step__content">
            <div class="formula-box">
                <span class="formula-box__label">Rumus Umum</span>
                <div style="text-align:center;padding:4px 0;">
                    \\[ f_1(x) = b_0 + b_1(x - x_0) \\]
                </div>
            </div>
            <div class="formula-box formula-box--highlight" style="margin-top:12px;">
                <span class="formula-box__label">Hasil Substitusi</span>
                <div style="text-align:center;padding:4px 0;">
                    \\[ f_1(x) = ${fmt(b0)} + ${fmt(b1)}(x - ${fmt(x[0])}) \\]
                </div>
            </div>
        </div>
    </div>`;

    return html;
}

function calculate(x, y, xEval) {
    const chartCanvas = document.getElementById('chart');
    const chartEmpty = document.getElementById('chartEmpty');
    const resultSection = document.getElementById('resultSection');

    if (chartCanvas) chartCanvas.style.display = 'block';
    if (chartEmpty) chartEmpty.style.display = 'none';
    resultSection.classList.remove('hidden');

    const b0 = y[0];
    const b1 = (y[1] - y[0]) / (x[1] - x[0]);
    const result = b0 + b1 * (xEval - x[0]);
    const fmt = MathUtils.fmt;

    let html = buildPartialSteps(x, y, b0, b1, fmt);

    const prodVal = xEval - x[0];
    html += `
    <div class="step">
        <div class="step__number">6</div>
        <div class="step__title">Evaluasi di \\( x = ${fmt(xEval)} \\)</div>
        <div class="step__content">
            <div class="formula-box">
                <div style="text-align:center;padding:4px 0;">
                    \\[ f_1(${fmt(xEval)}) = ${fmt(b0)} + ${fmt(b1)}(${fmt(xEval)} - ${fmt(x[0])}) \\]
                    \\[ = ${fmt(b0)} + ${fmt(b1)} \\cdot ${fmt(prodVal)} \\]
                    \\[ = ${fmt(b0)} + ${fmt(b1 * prodVal)} \\]
                </div>
            </div>
            <div class="result-box" style="margin-top:16px;">
                <div class="result-box__label">Hasil Akhir</div>
                <div class="result-box__value">f(${fmt(xEval)}) = ${fmt(result)}</div>
            </div>
        </div>
    </div>`;

    const stepsContainer = document.getElementById('stepsContainer');
    smoothContentTransition(stepsContainer, html, () => {
        renderMath(resultSection);
    });

    const coefficients = [b0, b1];
    const xMin = Math.min(...x, xEval) - 1;
    const xMax = Math.max(...x, xEval) + 1;
    const curve = MathUtils.generateCurvePoints(coefficients, x, xMin, xMax, 200);

    createInterpolationChart('chart',
        { x, y },
        curve,
        { x: xEval, y: result },
        'Grafik Interpolasi Lanjar'
    );
}
