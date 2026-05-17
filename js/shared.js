/* ============================================
   SHARED JS - Animasi (anime.js v4), Navbar, Chart, Auto-Calculate
   FIXED: Transform-based updates, NO DOM refresh
   ============================================ */

// Destructure anime.js v4 API from UMD global
const { animate: _animate, stagger: _stagger, createTimeline: _createTimeline } = (typeof anime !== 'undefined') ? anime : {};

document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initAnimeAnimations();
    initLucideIcons();
});

/* --- Navbar --- */
function initNavbar() {
    const navbar = document.querySelector('.navbar');
    const toggle = document.querySelector('.navbar__toggle');
    const nav = document.querySelector('.navbar__nav');

    if (toggle && nav) {
        toggle.addEventListener('click', () => {
            nav.classList.toggle('open');
        });
        nav.querySelectorAll('.navbar__link').forEach(link => {
            link.addEventListener('click', () => nav.classList.remove('open'));
        });
    }

    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('scrolled', window.scrollY > 20);
        });
    }
}

/* --- anime.js Entrance Animations --- */
function initAnimeAnimations() {
    if (typeof _animate === 'undefined') return;

    const animationMap = {
        'fade-in': {
            translateY: [30, 0],
            opacity: [0, 1],
            duration: 900,
            ease: 'outExpo'
        },
        'slide-left': {
            translateX: [-40, 0],
            opacity: [0, 1],
            duration: 800,
            ease: 'outExpo'
        },
        'scale-in': {
            scale: [0.85, 1],
            opacity: [0, 1],
            duration: 700,
            ease: 'outBack'
        }
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            const el = entry.target;
            observer.unobserve(el);

            let animConfig = null;
            for (const [className, config] of Object.entries(animationMap)) {
                if (el.classList.contains(className)) {
                    animConfig = { ...config };
                    break;
                }
            }

            if (!animConfig) return;

            const parent = el.parentElement;
            const siblings = parent ? Array.from(parent.querySelectorAll(`.${el.classList[0]}`)) : [];
            const siblingIndex = siblings.indexOf(el);
            const staggerDelay = siblingIndex > 0 ? siblingIndex * 80 : 0;

            _animate(el, {
                ...animConfig,
                delay: staggerDelay,
                onComplete: () => {
                    el.style.willChange = '';
                }
            });
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.fade-in, .slide-left, .scale-in').forEach(el => {
        el.style.willChange = 'transform, opacity';
        observer.observe(el);
    });

    const staggerObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            staggerObserver.unobserve(entry.target);

            const children = entry.target.children;
            _animate(children, {
                translateY: [40, 0],
                opacity: [0, 1],
                duration: 700,
                ease: 'outExpo',
                delay: _stagger(100, { start: 0 })
            });
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.stagger-children').forEach(parent => {
        Array.from(parent.children).forEach(child => {
            child.style.opacity = '0';
            child.style.transform = 'translateY(40px)';
        });
        staggerObserver.observe(parent);
    });
}

/* --- Lucide Icons --- */
function initLucideIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/* --- Debounce Utility --- */
function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/* --- Auto-Calculate Setup --- */
function setupAutoCalculate(containerSelector, calculateFn, delay = 350) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const debouncedCalc = debounce(calculateFn, delay);

    container.addEventListener('input', (e) => {
        if (e.target.matches('input[type="number"]')) {
            debouncedCalc();
        }
    });
}

/* ============================================================
   SMOOTH CONTENT TRANSITION - MORPHING, NEVER REFRESH
   ============================================================ 
   Strategi: 
   1. Pertama kali konten diisi → langsung masukkan + animasi masuk
   2. Update berikutnya → SELALU MORPHING:
      - Step yang sama: update in-place (transform pulse)
      - Step baru: slide-in dari bawah
      - Step yang dihapus: slide-out ke atas & collapse
      - TIDAK PERNAH flash/refresh seluruh container
   ============================================================ */

// Track previous content hash to detect actual changes
const _contentCache = new Map();

function smoothContentTransition(container, newHTML, callback) {
    if (!container) return;

    const containerId = container.id || 'default';
    const prevHash = _contentCache.get(containerId);
    const newHash = simpleHash(newHTML);

    // No change — skip entirely
    if (prevHash === newHash) {
        if (callback) callback();
        return;
    }

    _contentCache.set(containerId, newHash);

    const isFirstRender = !container.innerHTML.trim();

    if (isFirstRender) {
        container.innerHTML = newHTML;
        if (callback) callback();
        animateResultsIn(container);
        return;
    }

    // Parse new HTML to a temp container
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newHTML;

    // Pre-render MathJax on the disconnected temp container before morphing
    // This prevents the raw LaTeX from flashing on the screen.
    if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
        if (MathJax.typesetClear) {
            MathJax.typesetClear([tempDiv]);
        }
        MathJax.typesetPromise([tempDiv]).then(() => {
            const oldSteps = Array.from(container.querySelectorAll(':scope > .step'));
            const newSteps = Array.from(tempDiv.querySelectorAll(':scope > .step'));
            morphSteps(container, oldSteps, newSteps, callback);
        }).catch(err => {
            console.warn('MathJax pre-render error:', err);
            const oldSteps = Array.from(container.querySelectorAll(':scope > .step'));
            const newSteps = Array.from(tempDiv.querySelectorAll(':scope > .step'));
            morphSteps(container, oldSteps, newSteps, callback);
        });
    } else {
        const oldSteps = Array.from(container.querySelectorAll(':scope > .step'));
        const newSteps = Array.from(tempDiv.querySelectorAll(':scope > .step'));
        morphSteps(container, oldSteps, newSteps, callback);
    }
}

/* --- MORPH STEPS: The core morphing engine --- */
function morphSteps(container, oldSteps, newSteps, callback) {
    const oldCount = oldSteps.length;
    const newCount = newSteps.length;
    const commonCount = Math.min(oldCount, newCount);

    // 1. Update matching steps in-place
    for (let i = 0; i < commonCount; i++) {
        updateStepInPlace(oldSteps[i], newSteps[i]);
    }

    // 2. Remove extra old steps (slide-out + collapse)
    if (oldCount > newCount) {
        const stepsToRemove = oldSteps.slice(newCount);
        morphRemoveSteps(stepsToRemove);
    }

    // 3. Add new steps (slide-in from below)
    if (newCount > oldCount) {
        const stepsToAdd = newSteps.slice(oldCount);
        morphAddSteps(container, stepsToAdd);
    }

    // Fire callback (triggers MathJax which will animate after render)
    if (callback) callback();
}

/* --- Slide-in new steps from below with stagger --- */
function morphAddSteps(container, newStepElements) {
    const useAnime = typeof _animate !== 'undefined';

    newStepElements.forEach((stepEl, idx) => {
        // Clone into live DOM
        const liveStep = stepEl.cloneNode(true);
        container.appendChild(liveStep);

        if (useAnime) {
            // Start hidden below
            liveStep.style.opacity = '0';
            liveStep.style.transform = 'translateY(30px) scale(0.97)';
            liveStep.style.overflow = 'hidden';

            _animate(liveStep, {
                translateY: [30, 0],
                scale: [0.97, 1],
                opacity: [0, 1],
                duration: 500,
                ease: 'outCubic',
                delay: idx * 60,
                onComplete: () => {
                    liveStep.style.transform = '';
                    liveStep.style.opacity = '';
                    liveStep.style.overflow = '';
                }
            });
        }
    });
}

/* --- Slide-out removed steps upward & collapse height --- */
function morphRemoveSteps(stepsToRemove) {
    const useAnime = typeof _animate !== 'undefined';

    stepsToRemove.forEach((stepEl, idx) => {
        if (useAnime) {
            const h = stepEl.offsetHeight;
            stepEl.style.overflow = 'hidden';
            stepEl.style.maxHeight = h + 'px';

            _animate(stepEl, {
                translateY: [0, -15],
                opacity: [1, 0],
                maxHeight: [h, 0],
                marginBottom: [undefined, 0],
                paddingTop: [undefined, 0],
                paddingBottom: [undefined, 0],
                duration: 350,
                ease: 'inCubic',
                delay: idx * 40,
                onComplete: () => {
                    stepEl.remove();
                }
            });
        } else {
            stepEl.remove();
        }
    });
}

// Update a single step's content without destroying the DOM
function updateStepInPlace(oldStep, newStep) {
    // Update step number
    const oldNum = oldStep.querySelector('.step__number');
    const newNum = newStep.querySelector('.step__number');
    if (oldNum && newNum && oldNum.textContent !== newNum.textContent) {
        oldNum.textContent = newNum.textContent;
    }

    // Update step title
    const oldTitle = oldStep.querySelector('.step__title');
    const newTitle = newStep.querySelector('.step__title');
    if (oldTitle && newTitle && oldTitle.innerHTML !== newTitle.innerHTML) {
        oldTitle.innerHTML = newTitle.innerHTML;
    }

    // Update step content — morph each sub-element type independently
    const oldContent = oldStep.querySelector('.step__content');
    const newContent = newStep.querySelector('.step__content');
    if (!oldContent || !newContent) return;

    // Quick check: if content is identical, skip entirely
    if (oldContent.innerHTML === newContent.innerHTML) return;

    // --- Morph sub-elements by type ---

    // Formula boxes
    morphSubElements(oldContent,
        oldContent.querySelectorAll(':scope > .formula-box, :scope > div > .formula-box'),
        newContent.querySelectorAll(':scope > .formula-box, :scope > div > .formula-box'),
        '.formula-box');

    // Table wrappers
    morphSubElements(oldContent,
        oldContent.querySelectorAll('.table-wrapper'),
        newContent.querySelectorAll('.table-wrapper'),
        '.table-wrapper');

    // Result box
    const oldResult = oldContent.querySelector('.result-box');
    const newResult = newContent.querySelector('.result-box');
    if (oldResult && newResult && oldResult.innerHTML !== newResult.innerHTML) {
        oldResult.innerHTML = newResult.innerHTML;
        oldResult.classList.add('morph-highlight');
    } else if (!oldResult && newResult) {
        const clone = newResult.cloneNode(true);
        clone.style.opacity = '0';
        oldContent.appendChild(clone);
        if (typeof _animate !== 'undefined') {
            _animate(clone, { scale: [0.9, 1], opacity: [0, 1], duration: 400, ease: 'outCubic' });
        } else {
            clone.style.opacity = '1';
        }
    } else if (oldResult && !newResult) {
        oldResult.remove();
    }

    // Computation blocks
    morphSubElements(oldContent,
        oldContent.querySelectorAll('.computation'),
        newContent.querySelectorAll('.computation'),
        '.computation');

    // Paragraphs — morph even if counts differ
    morphSubElements(oldContent,
        oldContent.querySelectorAll(':scope > p'),
        newContent.querySelectorAll(':scope > p'),
        'p');

    // Remove any highlighted class after a short delay
    setTimeout(() => {
        oldContent.querySelectorAll('.morph-highlight').forEach(el => {
            el.classList.remove('morph-highlight');
        });
    }, 600);
}

/* --- Morph sub-elements within a step --- */
function morphSubElements(parentEl, oldEls, newEls, selector) {
    const oldArr = Array.from(oldEls);
    const newArr = Array.from(newEls);
    const commonLen = Math.min(oldArr.length, newArr.length);

    // Update matching without hiding
    for (let i = 0; i < commonLen; i++) {
        if (oldArr[i].innerHTML !== newArr[i].innerHTML) {
            oldArr[i].innerHTML = newArr[i].innerHTML;
            oldArr[i].classList.add('morph-highlight');
        }
    }

    // Remove extras
    for (let i = commonLen; i < oldArr.length; i++) {
        oldArr[i].remove();
    }

    // Add new ones
    for (let i = commonLen; i < newArr.length; i++) {
        const clone = newArr[i].cloneNode(true);
        clone.style.opacity = '0';
        parentEl.appendChild(clone);
        if (typeof _animate !== 'undefined') {
            _animate(clone, { translateY: [10, 0], opacity: [0, 1], duration: 400, ease: 'outCubic' });
        } else {
            clone.style.opacity = '1';
        }
    }
}

// Minimal CSS added dynamically for morph-highlight
if (!document.getElementById('morph-styles')) {
    const style = document.createElement('style');
    style.id = 'morph-styles';
    style.innerHTML = `
        .morph-highlight {
            animation: morphPulse 0.6s ease-out;
        }
        @keyframes morphPulse {
            0% { color: #38bdf8; text-shadow: 0 0 8px rgba(56, 189, 248, 0.5); }
            100% { color: inherit; text-shadow: none; }
        }
    `;
    document.head.appendChild(style);
}

// Animate only elements that were marked as changed - removed for smooth morphing
function animateValueChanges(container) {
    // Intentionally empty: we no longer hide and fade-in elements on update
    // Instead we use the CSS animation on .morph-highlight
}

// Simple hash for content comparison
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return hash;
}

/* --- Animate Steps First Reveal (anime.js) --- */
function animateResultsIn(container) {
    if (typeof _animate === 'undefined') return;
    if (!container) return;

    // Animate steps with stagger
    const steps = container.querySelectorAll('.step');
    if (steps.length) {
        steps.forEach(s => {
            s.style.opacity = '0';
            s.style.transform = 'translateY(20px) scale(0.98)';
        });

        _animate(steps, {
            translateY: [20, 0],
            scale: [0.98, 1],
            opacity: [0, 1],
            duration: 650,
            ease: 'outExpo',
            delay: _stagger(60)
        });
    }

    // Animate formula boxes
    const formulaBoxes = container.querySelectorAll('.formula-box');
    if (formulaBoxes.length) {
        formulaBoxes.forEach(fb => {
            fb.style.opacity = '0';
            fb.style.transform = 'translateY(12px) scale(0.95)';
        });

        _animate(formulaBoxes, {
            scale: [0.95, 1],
            translateY: [12, 0],
            opacity: [0, 1],
            duration: 500,
            ease: 'outBack',
            delay: _stagger(40)
        });
    }

    // Animate computation text
    const computations = container.querySelectorAll('.computation');
    if (computations.length) {
        computations.forEach(c => {
            c.style.opacity = '0';
            c.style.transform = 'translateX(-15px)';
        });

        _animate(computations, {
            translateX: [-15, 0],
            opacity: [0, 1],
            duration: 450,
            ease: 'outCubic',
            delay: _stagger(50)
        });
    }

    // Animate tables
    const tables = container.querySelectorAll('.table-wrapper');
    if (tables.length) {
        tables.forEach(t => {
            t.style.opacity = '0';
            t.style.transform = 'translateY(10px)';
        });

        _animate(tables, {
            opacity: [0, 1],
            translateY: [10, 0],
            duration: 450,
            ease: 'outCubic',
            delay: _stagger(50)
        });
    }

    // Animate result box with dramatic bounce
    const resultBox = container.querySelector('.result-box');
    if (resultBox) {
        resultBox.style.opacity = '0';
        resultBox.style.transform = 'scale(0.85) translateY(15px)';

        _animate(resultBox, {
            scale: [0.85, 1],
            translateY: [15, 0],
            opacity: [0, 1],
            duration: 700,
            ease: 'outElastic(1, .6)'
        });
    }
}

/* --- Legacy alias for backward compat --- */
function animateResultsTransition(containerOrSelector) {
    const container = typeof containerOrSelector === 'string'
        ? document.querySelector(containerOrSelector)
        : containerOrSelector;
    animateResultsIn(container);
}

function animateStepsReveal(containerSelector) {
    const container = document.querySelector(containerSelector);
    animateResultsIn(container);
}

/* --- Create / Update Interpolation Chart (smooth transitions) --- */
function createInterpolationChart(canvasId, dataPoints, curvePoints, evalPoint = null, title = '') {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    // Safety filter: buang NaN/Infinity dari curve data
    const safeCurveData = curvePoints.x
        .map((x, i) => ({ x, y: curvePoints.y[i] }))
        .filter(p => isFinite(p.x) && isFinite(p.y));

    const safePointData = dataPoints.x
        .map((x, i) => ({ x, y: dataPoints.y[i] }))
        .filter(p => isFinite(p.x) && isFinite(p.y));

    const datasets = [
        {
            label: 'Kurva Interpolasi',
            data: safeCurveData,
            borderColor: 'rgba(99, 102, 241, 0.8)',
            backgroundColor: 'rgba(99, 102, 241, 0.05)',
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: true,
            showLine: true,
            tension: 0,  // tension 0 karena kita sudah punya banyak titik (200+)
            order: 2
        },
        {
            label: 'Titik Data',
            data: safePointData,
            borderColor: '#22d3ee',
            backgroundColor: '#22d3ee',
            borderWidth: 0,
            pointRadius: 7,
            pointHoverRadius: 10,
            pointStyle: 'circle',
            pointBorderColor: '#0e0e18',
            pointBorderWidth: 2,
            showLine: false,
            order: 1
        }
    ];

    if (evalPoint) {
        datasets.push({
            label: `Hasil (x = ${MathUtils.fmt(evalPoint.x)})`,
            data: [{ x: evalPoint.x, y: evalPoint.y }],
            borderColor: '#10b981',
            backgroundColor: '#10b981',
            borderWidth: 3,
            pointRadius: 9,
            pointHoverRadius: 12,
            pointStyle: 'rectRot',
            pointBorderColor: '#0e0e18',
            pointBorderWidth: 2,
            showLine: false,
            order: 0
        });
    }

    const chartConfig = {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 600,
                easing: 'easeInOutQuart'
            },
            transitions: {
                active: {
                    animation: {
                        duration: 500
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                intersect: false,
                axis: 'x'
            },
            plugins: {
                title: {
                    display: !!title,
                    text: title,
                    color: '#f1f5f9',
                    font: { family: 'Inter', size: 13, weight: '600' },
                    padding: { bottom: 12 }
                },
                legend: {
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 11 },
                        usePointStyle: true,
                        padding: 16
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(19, 19, 31, 0.95)',
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 6,
                    titleFont: { family: 'Inter', weight: '600' },
                    bodyFont: { family: 'JetBrains Mono', size: 11 },
                    usePointStyle: true,
                    callbacks: {
                        label: function(ctx) {
                            return ` (${MathUtils.fmt(ctx.parsed.x)}, ${MathUtils.fmt(ctx.parsed.y)})`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    grid: {
                        color: 'rgba(255,255,255,0.04)',
                        drawTicks: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'JetBrains Mono', size: 10 },
                        padding: 6
                    },
                    border: { color: 'rgba(255,255,255,0.08)' },
                    title: {
                        display: true,
                        text: 'x',
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 12, weight: '500' }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255,255,255,0.04)',
                        drawTicks: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: { family: 'JetBrains Mono', size: 10 },
                        padding: 6
                    },
                    border: { color: 'rgba(255,255,255,0.08)' },
                    title: {
                        display: true,
                        text: 'y',
                        color: '#94a3b8',
                        font: { family: 'Inter', size: 12, weight: '500' }
                    }
                }
            }
        }
    };

    // --- SMOOTH UPDATE: Reuse existing chart instance ---
    const existing = Chart.getChart(ctx);
    if (existing) {
        // Update datasets in place for smooth transform animation
        // Update curve data
        if (existing.data.datasets[0]) {
            existing.data.datasets[0].data = datasets[0].data;
        }
        // Update point data
        if (existing.data.datasets[1]) {
            existing.data.datasets[1].data = datasets[1].data;
        }
        // Update eval point
        if (evalPoint) {
            if (existing.data.datasets[2]) {
                existing.data.datasets[2].data = datasets[2].data;
                existing.data.datasets[2].label = datasets[2].label;
            } else {
                existing.data.datasets.push(datasets[2]);
            }
        } else if (existing.data.datasets[2]) {
            existing.data.datasets.splice(2, 1);
        }

        existing.options.plugins.title.text = title;
        existing.options.plugins.title.display = !!title;
        existing.update('active');
        return existing;
    }

    // First creation
    const chart = new Chart(ctx, chartConfig);
    return chart;
}

/* --- Re-render MathJax then animate changed elements --- */
function renderMath(element) {
    if (typeof MathJax !== 'undefined' && MathJax.typesetPromise) {
        const el = element || document.body;
        MathJax.typesetPromise([el]).then(() => {
            // After MathJax finishes rendering, fade in changed elements
            animateValueChanges(el);
        }).catch(err => console.warn('MathJax error:', err));
    } else {
        // No MathJax — just animate immediately
        if (element) animateValueChanges(element);
    }
}

/* --- Show Error Toast --- */
function showError(container, messages) {
    if (!container) return;
    container.innerHTML = messages.map(msg =>
        `<div style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);border-radius:8px;color:#f87171;font-size:0.85rem;">
            <i data-lucide="alert-circle" style="width:16px;height:16px;flex-shrink:0;"></i>
            <span>${msg}</span>
        </div>`
    ).join('');
    initLucideIcons();
}

function clearError(container) {
    if (container) container.innerHTML = '';
}

/* --- Scroll to element --- */
function scrollToElement(selector) {
    const el = document.querySelector(selector);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
