/* ============================================
   MATH UTILITIES - Interpolasi Numerik
   ============================================ */

const MathUtils = {

    /**
     * Hitung divided differences table
     * @param {number[]} x - Array titik x
     * @param {number[]} y - Array titik y (f(x))
     * @returns {number[][]} Tabel divided differences
     */
    dividedDifferences(x, y) {
        const n = x.length;
        const table = [];
        
        // Orde 0: f[xᵢ] = yᵢ
        table[0] = [...y];
        
        // Orde 1 sampai n-1
        for (let order = 1; order < n; order++) {
            table[order] = [];
            for (let i = 0; i < n - order; i++) {
                table[order][i] = (table[order - 1][i + 1] - table[order - 1][i]) / (x[i + order] - x[i]);
            }
        }
        
        return table;
    },

    /**
     * Hitung koefisien Newton dari divided differences
     * @param {number[][]} table - Tabel divided differences
     * @returns {number[]} Koefisien b₀, b₁, ..., bₙ
     */
    getNewtonCoefficients(table) {
        return table.map(row => row[0]);
    },

    /**
     * Evaluasi polinom Newton di titik x
     * @param {number[]} coefficients - Koefisien b
     * @param {number[]} xPoints - Titik-titik x data
     * @param {number} xEval - Titik x yang dievaluasi
     * @returns {number} Hasil evaluasi
     */
    evaluateNewton(coefficients, xPoints, xEval) {
        let result = coefficients[0];
        let product = 1;
        
        for (let i = 1; i < coefficients.length; i++) {
            product *= (xEval - xPoints[i - 1]);
            result += coefficients[i] * product;
        }
        
        return result;
    },

    /**
     * Generate titik-titik untuk kurva interpolasi
     * @param {number[]} coefficients - Koefisien Newton
     * @param {number[]} xPoints - Titik-titik x data
     * @param {number} xMin - Batas kiri
     * @param {number} xMax - Batas kanan
     * @param {number} numPoints - Jumlah titik kurva
     * @returns {{x: number[], y: number[]}} Titik-titik kurva
     */
    generateCurvePoints(coefficients, xPoints, xMin, xMax, numPoints = 200) {
        const curveX = [];
        const curveY = [];
        const step = (xMax - xMin) / numPoints;
        
        for (let i = 0; i <= numPoints; i++) {
            const xi = xMin + i * step;
            curveX.push(xi);
            curveY.push(this.evaluateNewton(coefficients, xPoints, xi));
        }
        
        return { x: curveX, y: curveY };
    },

    /**
     * Generate langkah-langkah pengerjaan divided differences
     * @param {number[]} x - Array titik x
     * @param {number[]} y - Array titik y
     * @returns {object[]} Array langkah-langkah
     */
    generateDividedDiffSteps(x, y) {
        const n = x.length;
        const steps = [];
        const table = [];
        
        // Orde 0
        table[0] = [...y];
        steps.push({
            order: 0,
            title: 'Orde 0 (Nilai Fungsi)',
            entries: y.map((val, i) => ({
                notation: `f[x_${i}]`,
                formula: `f(${this.fmt(x[i])})`,
                value: val,
                detail: `= ${this.fmt(val)}`
            }))
        });
        
        // Orde 1 sampai n-1
        for (let order = 1; order < n; order++) {
            table[order] = [];
            const entries = [];
            
            for (let i = 0; i < n - order; i++) {
                const numerator = table[order - 1][i + 1] - table[order - 1][i];
                const denominator = x[i + order] - x[i];
                const value = numerator / denominator;
                table[order][i] = value;
                
                // Build notation
                const indices = [];
                for (let k = i + order; k >= i; k--) {
                    indices.push(`x_${k}`);
                }
                const notation = `f[${indices.join(', ')}]`;
                
                entries.push({
                    notation,
                    formula: `\\frac{f[${this.buildNotation(i+1, order-1)}] - f[${this.buildNotation(i, order-1)}]}{x_{${i+order}} - x_{${i}}}`,
                    substitution: `\\frac{${this.fmt(table[order-1][i+1])} - ${this.fmt(table[order-1][i])}}{${this.fmt(x[i+order])} - ${this.fmt(x[i])}}`,
                    calcDetail: `\\frac{${this.fmt(numerator)}}{${this.fmt(denominator)}}`,
                    value,
                    detail: `= ${this.fmt(value)}`
                });
            }
            
            steps.push({
                order,
                title: `Orde ${order} (Divided Difference)`,
                entries
            });
        }
        
        return { steps, table, coefficients: table.map(row => row[0]) };
    },

    /**
     * Build divided difference notation string
     */
    buildNotation(startIdx, order) {
        const indices = [];
        for (let k = startIdx + order; k >= startIdx; k--) {
            indices.push(`x_${k}`);
        }
        return indices.join(', ');
    },

    /**
     * Build rumus polinom Newton sebagai LaTeX
     * @param {number} order - Orde polinom (1=lanjar, 2=kuadratik, dst)
     * @returns {string} LaTeX string
     */
    buildNewtonFormulaGeneric(order) {
        let formula = 'P(x) = b_0';
        for (let i = 1; i <= order; i++) {
            formula += ` + b_${i}`;
            const products = [];
            for (let j = 0; j < i; j++) {
                products.push(`(x - x_${j})`);
            }
            formula += products.join('');
        }
        return formula;
    },

    /**
     * Build rumus dengan nilai tersubstitusi
     * @param {number[]} coefficients - Koefisien b
     * @param {number[]} xPoints - Titik x
     * @returns {string} LaTeX string
     */
    buildNewtonFormulaSubstituted(coefficients, xPoints) {
        let formula = `P(x) = ${this.fmt(coefficients[0])}`;
        for (let i = 1; i < coefficients.length; i++) {
            const sign = coefficients[i] >= 0 ? '+' : '';
            formula += ` ${sign} ${this.fmt(coefficients[i])}`;
            for (let j = 0; j < i; j++) {
                const xVal = xPoints[j];
                if (xVal >= 0) {
                    formula += `(x - ${this.fmt(xVal)})`;
                } else {
                    formula += `(x + ${this.fmt(Math.abs(xVal))})`;
                }
            }
        }
        return formula;
    },

    /**
     * Build evaluasi langkah demi langkah
     */
    buildEvaluationSteps(coefficients, xPoints, xEval) {
        const steps = [];
        let result = coefficients[0];
        let product = 1;
        
        steps.push({
            term: `b_0 = ${this.fmt(coefficients[0])}`,
            cumulative: result
        });
        
        for (let i = 1; i < coefficients.length; i++) {
            product *= (xEval - xPoints[i - 1]);
            const termValue = coefficients[i] * product;
            result += termValue;
            
            let productStr = '';
            for (let j = 0; j < i; j++) {
                const diff = xEval - xPoints[j];
                productStr += `(${this.fmt(diff)})`;
            }
            
            steps.push({
                term: `b_${i} \\cdot ${productStr} = ${this.fmt(coefficients[i])} \\cdot ${this.fmt(product)} = ${this.fmt(termValue)}`,
                cumulative: result
            });
        }
        
        return { steps, result };
    },

    /**
     * Format angka (bulatkan ke desimal yang wajar)
     */
    fmt(num) {
        if (Number.isInteger(num)) return num.toString();
        // Cek apakah bisa dibulatkan ke integer tanpa kehilangan presisi
        if (Math.abs(num - Math.round(num)) < 1e-10) {
            return Math.round(num).toString();
        }
        // Bulatkan ke 6 desimal, hapus trailing zeros
        const formatted = parseFloat(num.toFixed(6));
        return formatted.toString();
    },

    /**
     * Eliminasi Gauss untuk menyelesaikan Ax = b
     * @param {number[][]} A - Matriks koefisien
     * @param {number[]} b - Vektor konstanta
     * @returns {{solution: number[], steps: object[]}} Solusi dan langkah
     */
    gaussianElimination(A, b) {
        const n = A.length;
        const steps = [];
        
        // Augmented matrix
        const aug = A.map((row, i) => [...row, b[i]]);
        
        steps.push({
            title: 'Matriks Augmented Awal',
            matrix: aug.map(row => [...row])
        });
        
        // Forward elimination
        for (let k = 0; k < n - 1; k++) {
            // Partial pivoting
            let maxRow = k;
            let maxVal = Math.abs(aug[k][k]);
            for (let i = k + 1; i < n; i++) {
                if (Math.abs(aug[i][k]) > maxVal) {
                    maxVal = Math.abs(aug[i][k]);
                    maxRow = i;
                }
            }
            if (maxRow !== k) {
                [aug[k], aug[maxRow]] = [aug[maxRow], aug[k]];
            }
            
            for (let i = k + 1; i < n; i++) {
                const factor = aug[i][k] / aug[k][k];
                for (let j = k; j <= n; j++) {
                    aug[i][j] -= factor * aug[k][j];
                }
            }
            
            steps.push({
                title: `Eliminasi kolom ${k + 1}`,
                matrix: aug.map(row => [...row])
            });
        }
        
        // Back substitution
        const solution = new Array(n).fill(0);
        for (let i = n - 1; i >= 0; i--) {
            let sum = aug[i][n];
            for (let j = i + 1; j < n; j++) {
                sum -= aug[i][j] * solution[j];
            }
            solution[i] = sum / aug[i][i];
        }
        
        steps.push({
            title: 'Substitusi Balik',
            solution: [...solution]
        });
        
        return { solution, steps };
    },

    /**
     * Validasi input titik
     */
    validatePoints(x, y, requiredCount = null) {
        const errors = [];
        
        if (x.length !== y.length) {
            errors.push('Jumlah titik x dan y harus sama');
        }
        
        if (requiredCount !== null && x.length !== requiredCount) {
            errors.push(`Diperlukan tepat ${requiredCount} titik data`);
        }
        
        if (x.length < 2) {
            errors.push('Minimal diperlukan 2 titik data');
        }
        
        // Cek duplikat x
        const uniqueX = new Set(x);
        if (uniqueX.size !== x.length) {
            errors.push('Nilai x tidak boleh ada yang sama (duplikat)');
        }
        
        // Cek NaN
        for (let i = 0; i < x.length; i++) {
            if (isNaN(x[i]) || isNaN(y[i])) {
                errors.push(`Titik ke-${i + 1}: nilai tidak valid`);
            }
        }
        
        return { valid: errors.length === 0, errors };
    }
};

// Export for global usage
window.MathUtils = MathUtils;
