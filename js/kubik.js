/* ============================================
   KUBIK.JS - Interpolasi Kubik (Orde 3)
   Batasan: Tepat 4 titik data
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
        document.getElementById('x3').value = '5';
        document.getElementById('y3').value = '3';
        document.getElementById('xEval').value = '2';
        runCalculation();
    });

    setupAutoCalculate('#kubikWorkspace', runCalculation, 350);
});

function initDefaultDisplay() {
    const resultSection = document.getElementById('resultSection');
    const stepsContainer = document.getElementById('stepsContainer');
    const chartCanvas = document.getElementById('chart');
    const chartEmpty = document.getElementById('chartEmpty');

    resultSection.classList.remove('hidden');
    stepsContainer.innerHTML = buildProgressiveHTML(
        [NaN,NaN,NaN,NaN], [NaN,NaN,NaN,NaN], [], [], NaN
    );
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
        'Grafik Interpolasi Kubik'
    );
}

function collectData() {
    const pairs = [['x0','y0'],['x1','y1'],['x2','y2'],['x3','y3']];
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

function computeDividedDifferences(x, y) {
    const b0 = y[0];
    const f01 = (y[1] - y[0]) / (x[1] - x[0]);
    const f12 = (y[2] - y[1]) / (x[2] - x[1]);
    const f23 = (y[3] - y[2]) / (x[3] - x[2]);
    const f012 = (f12 - f01) / (x[2] - x[0]);
    const f123 = (f23 - f12) / (x[3] - x[1]);
    const f0123 = (f123 - f012) / (x[3] - x[0]);

    return {
        b0, b1: f01, b2: f012, b3: f0123,
        f01, f12, f23, f012, f123, f0123,
        coefficients: [b0, f01, f012, f0123]
    };
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

    const allComplete = validX.length === 4;
    let curve, evalPoint = null;

    if (allComplete) {
        const dd = computeDividedDifferences(validX, validY);
        const extras = !isNaN(xEval) ? [xEval] : [];
        const xMin = Math.min(...validX, ...extras) - 1;
        const xMax = Math.max(...validX, ...extras) + 1;
        curve = MathUtils.generateCurvePoints(dd.coefficients, validX, xMin, xMax, 300);

        if (!isNaN(xEval)) {
            const { b0, b1, b2, b3 } = dd;
            const result = b0 + b1*(xEval-validX[0]) + b2*(xEval-validX[0])*(xEval-validX[1]) + b3*(xEval-validX[0])*(xEval-validX[1])*(xEval-validX[2]);
            evalPoint = { x: xEval, y: result };
        }
    } else {
        const xMin = Math.min(...validX) - 2;
        const xMax = Math.max(...validX) + 2;
        curve = { x: [xMin, xMax], y: [0, 0] };
    }

    createInterpolationChart('chart',
        { x: validX, y: validY },
        curve,
        evalPoint,
        'Grafik Interpolasi Kubik'
    );
}

function buildProgressiveHTML(rawX, rawY, validX, validY, xEval) {
    const fmt = MathUtils.fmt;
    const d = (v) => isNaN(v) ? '—' : fmt(v);
    let html = '';

    // Step 1: Rumus Umum
    html += `
    <div class="step">
        <div class="step__number">1</div>
        <div class="step__title">Rumus Umum Interpolasi Kubik</div>
        <div class="step__content">
            <p style="margin-bottom:12px;color:var(--text-muted);">Interpolasi kubik (orde-3) menggunakan 4 titik data:</p>
            <div class="formula-box formula-box--highlight">
                <span class="formula-box__label">Rumus Umum</span>
                <div style="text-align:center;padding:8px 0;">
                    \\[ f_3(x) = b_0 + b_1(x-x_0) + b_2(x-x_0)(x-x_1) + b_3(x-x_0)(x-x_1)(x-x_2) \\]
                </div>
            </div>
            <div style="margin-top:12px;">
                <p style="font-size:0.85rem;color:var(--text-muted);">Koefisien dihitung dengan <em>divided differences</em> orde 1, 2, dan 3:</p>
                <div class="computation" style="margin-top:8px;">
                    \\( b_0 = f(x_0) \\)<br>
                    \\( b_1 = f[x_0, x_1] \\)<br>
                    \\( b_2 = f[x_0, x_1, x_2] \\)<br>
                    \\( b_3 = f[x_0, x_1, x_2, x_3] \\)
                </div>
            </div>
        </div>
    </div>`;

    // Step 2: Tabel Data (progresif)
    html += `
    <div class="step">
        <div class="step__number">2</div>
        <div class="step__title">Data yang Diketahui</div>
        <div class="step__content">
            <div class="table-wrapper">
                <table class="table">
                    <thead><tr><th>i</th><th>\\(x_i\\)</th><th>\\(y_i\\)</th></tr></thead>
                    <tbody>
                        <tr><td>0</td><td>${d(rawX[0])}</td><td>${d(rawY[0])}</td></tr>
                        <tr><td>1</td><td>${d(rawX[1])}</td><td>${d(rawY[1])}</td></tr>
                        <tr><td>2</td><td>${d(rawX[2])}</td><td>${d(rawY[2])}</td></tr>
                        <tr><td>3</td><td>${d(rawX[3])}</td><td>${d(rawY[3])}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;

    // Kalau belum ada 4 titik valid — stop
    if (validX.length < 4) {
        html += `
        <div class="step">
            <div class="step__number">3</div>
            <div class="step__title">Menunggu Data Lengkap</div>
            <div class="step__content">
                <p style="color:var(--text-muted);font-size:0.9rem;">Masukkan semua 4 pasang titik data (x, y) untuk melihat perhitungan lengkap. (${validX.length}/4 titik terisi)</p>
            </div>
        </div>`;
        return html;
    }

    // Full calculation
    const x = validX, y = validY;
    const dd = computeDividedDifferences(x, y);
    const { b0, b1, b2, b3, f01, f12, f23, f012, f123, f0123 } = dd;

    // Step 3: b0
    html += `
    <div class="step">
        <div class="step__number">3</div>
        <div class="step__title">Hitung \\( b_0 \\)</div>
        <div class="step__content">
            <div class="formula-box"><div style="text-align:center;">
                \\[ b_0 = f(x_0) = ${fmt(b0)} \\]
            </div></div>
        </div>
    </div>`;

    // Step 4: DD Orde-1
    html += `
    <div class="step">
        <div class="step__number">4</div>
        <div class="step__title">Divided Differences Orde-1</div>
        <div class="step__content">
            <div class="formula-box">
                <div style="text-align:center;padding:4px 0;">
                    \\[ f[x_0,x_1] = \\frac{${fmt(y[1])}-${fmt(y[0])}}{${fmt(x[1])}-${fmt(x[0])}} = ${fmt(f01)} \\]
                    \\[ f[x_1,x_2] = \\frac{${fmt(y[2])}-${fmt(y[1])}}{${fmt(x[2])}-${fmt(x[1])}} = ${fmt(f12)} \\]
                    \\[ f[x_2,x_3] = \\frac{${fmt(y[3])}-${fmt(y[2])}}{${fmt(x[3])}-${fmt(x[2])}} = ${fmt(f23)} \\]
                </div>
            </div>
            <div class="formula-box formula-box--highlight" style="margin-top:12px;">
                <span class="formula-box__label">\\(b_1\\)</span>
                <div style="text-align:center;">\\[ b_1 = f[x_0,x_1] = ${fmt(b1)} \\]</div>
            </div>
        </div>
    </div>`;

    // Step 5: DD Orde-2
    html += `
    <div class="step">
        <div class="step__number">5</div>
        <div class="step__title">Divided Differences Orde-2</div>
        <div class="step__content">
            <div class="formula-box">
                <div style="text-align:center;padding:4px 0;">
                    \\[ f[x_0,x_1,x_2] = \\frac{f[x_1,x_2]-f[x_0,x_1]}{x_2-x_0} = \\frac{${fmt(f12)}-${fmt(f01)}}{${fmt(x[2])}-${fmt(x[0])}} = ${fmt(f012)} \\]
                    \\[ f[x_1,x_2,x_3] = \\frac{f[x_2,x_3]-f[x_1,x_2]}{x_3-x_1} = \\frac{${fmt(f23)}-${fmt(f12)}}{${fmt(x[3])}-${fmt(x[1])}} = ${fmt(f123)} \\]
                </div>
            </div>
            <div class="formula-box formula-box--highlight" style="margin-top:12px;">
                <span class="formula-box__label">\\(b_2\\)</span>
                <div style="text-align:center;">\\[ b_2 = f[x_0,x_1,x_2] = ${fmt(b2)} \\]</div>
            </div>
        </div>
    </div>`;

    // Step 6: DD Orde-3
    html += `
    <div class="step">
        <div class="step__number">6</div>
        <div class="step__title">Divided Differences Orde-3</div>
        <div class="step__content">
            <div class="formula-box">
                <div style="text-align:center;padding:4px 0;">
                    \\[ f[x_0,x_1,x_2,x_3] = \\frac{f[x_1,x_2,x_3]-f[x_0,x_1,x_2]}{x_3-x_0} = \\frac{${fmt(f123)}-${fmt(f012)}}{${fmt(x[3])}-${fmt(x[0])}} = ${fmt(f0123)} \\]
                </div>
            </div>
            <div class="formula-box formula-box--highlight" style="margin-top:12px;">
                <span class="formula-box__label">\\(b_3\\)</span>
                <div style="text-align:center;">\\[ b_3 = f[x_0,x_1,x_2,x_3] = ${fmt(b3)} \\]</div>
            </div>
        </div>
    </div>`;

    // Step 7: Tabel DD
    html += `
    <div class="step">
        <div class="step__number">7</div>
        <div class="step__title">Tabel Divided Differences</div>
        <div class="step__content">
            <div class="table-wrapper">
                <table class="table">
                    <thead><tr><th>\\(x_i\\)</th><th>\\(f(x_i)\\)</th><th>Orde 1</th><th>Orde 2</th><th>Orde 3</th></tr></thead>
                    <tbody>
                        <tr><td>${fmt(x[0])}</td><td>${fmt(y[0])}</td><td></td><td></td><td></td></tr>
                        <tr><td>${fmt(x[1])}</td><td>${fmt(y[1])}</td><td>${fmt(f01)}</td><td></td><td></td></tr>
                        <tr><td>${fmt(x[2])}</td><td>${fmt(y[2])}</td><td>${fmt(f12)}</td><td>${fmt(f012)}</td><td></td></tr>
                        <tr><td>${fmt(x[3])}</td><td>${fmt(y[3])}</td><td>${fmt(f23)}</td><td>${fmt(f123)}</td><td>${fmt(f0123)}</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;

    // Step 8: Polinom
    html += `
    <div class="step">
        <div class="step__number">8</div>
        <div class="step__title">Bentuk Polinom Interpolasi</div>
        <div class="step__content">
            <div class="formula-box formula-box--highlight">
                <span class="formula-box__label">Hasil</span>
                <div style="text-align:center;padding:4px 0;">
                    \\[ f_3(x) = ${fmt(b0)} + ${fmt(b1)}(x-${fmt(x[0])}) + ${fmt(b2)}(x-${fmt(x[0])})(x-${fmt(x[1])}) + ${fmt(b3)}(x-${fmt(x[0])})(x-${fmt(x[1])})(x-${fmt(x[2])}) \\]
                </div>
            </div>
        </div>
    </div>`;

    // Step 9: Evaluasi
    if (!isNaN(xEval)) {
        const t1 = b1 * (xEval - x[0]);
        const t2 = b2 * (xEval - x[0]) * (xEval - x[1]);
        const t3 = b3 * (xEval - x[0]) * (xEval - x[1]) * (xEval - x[2]);
        const result = b0 + t1 + t2 + t3;

        html += `
        <div class="step">
            <div class="step__number">9</div>
            <div class="step__title">Evaluasi di \\( x = ${fmt(xEval)} \\)</div>
            <div class="step__content">
                <div class="formula-box">
                    <div style="text-align:center;padding:4px 0;">
                        \\[ f_3(${fmt(xEval)}) = ${fmt(b0)} + ${fmt(t1)} + ${fmt(t2)} + ${fmt(t3)} \\]
                        \\[ = ${fmt(result)} \\]
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
