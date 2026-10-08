// RustScout motion layer. No libraries, no network requests.
// Loaded in <head> so html.motion is set before first paint (no flash of hidden content).
// All per-frame work writes transform/opacity only; layout is read once per resize.
(() => {
    const root = document.documentElement;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    let motion = !reduced.matches;
    root.classList.add('js');
    if (motion) root.classList.add('motion');

    const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    function splitText() {
        for (const el of $$('.split')) {
            let i = 0;
            const walk = node => {
                for (const child of Array.from(node.childNodes)) {
                    if (child.nodeType === 3) {
                        // words stay unbreakable so the per-character spans never wrap mid-word
                        const frag = document.createDocumentFragment();
                        for (const part of child.textContent.split(/(\s+)/)) {
                            if (!part) continue;
                            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
                            const word = document.createElement('span');
                            word.className = 'word';
                            for (const ch of part) {
                                const s = document.createElement('span');
                                s.className = 'ch';
                                s.style.setProperty('--i', i++);
                                s.textContent = ch;
                                word.appendChild(s);
                            }
                            frag.appendChild(word);
                        }
                        child.replaceWith(frag);
                    } else if (child.nodeType === 1) walk(child);
                }
            };
            walk(el);
        }
    }

    function reveals() {
        for (const box of $$('[data-stagger]')) $$(':scope > *', box).forEach((c, i) => c.style.setProperty('--i', i));
        const targets = $$('[data-reveal], [data-stagger]');
        if (!motion || !('IntersectionObserver' in window)) { targets.forEach(t => t.classList.add('in')); return; }
        const io = new IntersectionObserver(entries => {
            for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
        targets.forEach(t => io.observe(t));
    }

    function counters() {
        const els = $$('[data-count]');
        if (!motion || !('IntersectionObserver' in window)) return;
        const fmt = n => n.toLocaleString('en-US');
        for (const el of els) el.textContent = (el.dataset.prefix || '') + '0' + (el.dataset.suffix || '');
        const run = el => {
            const to = +el.dataset.count, dur = 1600, t0 = performance.now();
            const tick = now => {
                const p = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(2, -10 * p);
                el.textContent = (el.dataset.prefix || '') + fmt(Math.round(to * (p >= 1 ? 1 : e))) + (el.dataset.suffix || '');
                if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        };
        const io = new IntersectionObserver(entries => {
            for (const e of entries) if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
        }, { threshold: 0.6 });
        els.forEach(el => io.observe(el));
    }

    // Sticky "pinned" sections: whichever step crosses the middle of the viewport is active.
    function pins() {
        for (const pin of $$('[data-pin]')) {
            const steps = $$('.pin-step', pin), shots = $$('[data-shot]', pin);
            const rail = pin.querySelector('.pin-rail i'), cur = pin.querySelector('[data-pin-cur]');
            const set = i => {
                steps.forEach((s, k) => s.classList.toggle('on', k === i));
                shots.forEach((s, k) => s.classList.toggle('on', k === i));
                if (rail) rail.style.transform = `scaleY(${(i + 1) / steps.length})`;
                if (cur) cur.textContent = String(i + 1).padStart(2, '0');
            };
            set(0);
            if (!('IntersectionObserver' in window)) continue;
            const io = new IntersectionObserver(entries => {
                for (const e of entries) if (e.isIntersecting) set(steps.indexOf(e.target));
            }, { rootMargin: '-48% 0px -48% 0px' });
            steps.forEach(s => io.observe(s));
        }
    }

    // Hover tilt + cursor-following glow. Rect is read once on enter, writes are rAF-batched.
    function tilts() {
        if (!motion || !finePointer.matches) return;
        for (const el of $$('.tilt')) {
            const shine = document.createElement('span');
            shine.className = 'shine';
            shine.setAttribute('aria-hidden', 'true');
            el.prepend(shine);
            const max = +(el.dataset.tilt || 6);
            let rect = null, x = 0, y = 0, raf = 0;
            const paint = () => {
                raf = 0;
                const px = x / rect.width - .5, py = y / rect.height - .5;
                el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateZ(0)`;
                shine.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
            };
            el.addEventListener('pointerenter', () => { rect = el.getBoundingClientRect(); el.classList.add('hot'); });
            el.addEventListener('pointermove', e => {
                if (!rect) rect = el.getBoundingClientRect();
                x = e.clientX - rect.left; y = e.clientY - rect.top;
                if (!raf) raf = requestAnimationFrame(paint);
            });
            el.addEventListener('pointerleave', () => {
                if (raf) cancelAnimationFrame(raf), raf = 0;
                rect = null; el.classList.remove('hot'); el.style.transform = '';
            });
        }
    }

    // Floating embers behind the hero, drawn to a canvas; paused when offscreen or tab hidden.
    function embers() {
        const canvases = $$('canvas.fx-embers');
        if (!motion || !canvases.length) return;
        const sprite = document.createElement('canvas');
        sprite.width = sprite.height = 32;
        const sg = sprite.getContext('2d'), grad = sg.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255,190,140,1)'); grad.addColorStop(.25, 'rgba(255,122,47,.85)'); grad.addColorStop(1, 'rgba(224,68,47,0)');
        sg.fillStyle = grad; sg.fillRect(0, 0, 32, 32);
        for (const cv of canvases) {
            const ctx = cv.getContext('2d');
            let w = 0, h = 0, dpr = 1, parts = [], visible = false, raf = 0, last = 0;
            const spawn = (p, fresh) => {
                p.x = Math.random() * w; p.y = fresh ? Math.random() * h : h + 10;
                p.r = 1 + Math.random() * 2.6; p.vy = 12 + Math.random() * 38; p.sway = Math.random() * 6.28;
                p.sf = .4 + Math.random() * 1.2; p.a = .25 + Math.random() * .75; return p;
            };
            const size = () => {
                const r = cv.getBoundingClientRect();
                dpr = Math.min(devicePixelRatio || 1, 1.5); w = r.width; h = r.height;
                cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
                const n = Math.round(clamp(w / 22, 18, 64));
                parts = Array.from({ length: n }, () => spawn({}, true));
            };
            const frame = now => {
                raf = 0;
                if (!visible || document.hidden || !motion) return;
                const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
                ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                ctx.clearRect(0, 0, w, h);
                ctx.globalCompositeOperation = 'lighter';
                for (const p of parts) {
                    p.y -= p.vy * dt; p.sway += p.sf * dt;
                    if (p.y < -10) spawn(p, false);
                    const fade = clamp(p.y / h, 0, 1);
                    ctx.globalAlpha = p.a * fade;
                    const s = p.r * 6;
                    ctx.drawImage(sprite, p.x + Math.sin(p.sway) * 14 - s / 2, p.y - s / 2, s, s);
                }
                raf = requestAnimationFrame(frame);
            };
            const start = () => { if (!raf && visible && !document.hidden && motion) { last = 0; raf = requestAnimationFrame(frame); } };
            size();
            new ResizeObserver(() => size()).observe(cv);
            new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(cv);
            document.addEventListener('visibilitychange', start);
        }
    }

    // Scroll + pointer driven transforms (progress bar, parallax, hero tilt). One rAF per frame max.
    function scrollFx() {
        const bar = document.querySelector('.progress i');
        const par = $$('[data-parallax], [data-depth], [data-scroll-tilt]').map(el => ({
            el, f: +(el.dataset.parallax || 0), d: +(el.dataset.depth || 0), tilt: el.hasAttribute('data-scroll-tilt'), top: 0, h: 0
        }));
        let maxY = 1, vh = innerHeight, raf = 0, scrolled = null;
        let px = 0, py = 0, tx = 0, ty = 0;
        const measure = () => {
            vh = innerHeight;
            maxY = Math.max(1, root.scrollHeight - vh);
            // layout offsets ignore transforms, so entrance animations can't skew the measurement
            for (const p of par) {
                let n = p.el.parentElement || p.el, top = 0;
                p.h = n.offsetHeight;
                while (n) { top += n.offsetTop; n = n.offsetParent; }
                p.top = top;
            }
            request();
        };
        const frame = () => {
            raf = 0;
            const y = scrollY;
            if (bar) bar.style.transform = `scaleX(${clamp(y / maxY, 0, 1).toFixed(4)})`;
            const s = y > 8;
            if (s !== scrolled) { scrolled = s; root.classList.toggle('scrolled', s); }
            if (!motion) return;
            px += (tx - px) * .08; py += (ty - py) * .08;
            for (const p of par) {
                const c = p.top + p.h / 2 - y - vh / 2;
                if (Math.abs(c) > vh * 1.6) continue;
                if (p.tilt) {
                    const k = clamp(y / Math.max(1, p.top - vh * .35), 0, 1);
                    p.el.style.transform = `perspective(1600px) rotateX(${(22 * (1 - k)).toFixed(2)}deg) scale(${(.92 + .08 * k).toFixed(4)})`;
                    continue;
                }
                // first-screen elements start at rest and drift with scroll; later ones centre on the viewport
                const sy = (p.top < vh * 1.5 ? -y : -c) * p.f, mx = px * p.d * 26, my = py * p.d * 18;
                p.el.style.transform = `translate3d(${mx.toFixed(1)}px, ${(sy + my).toFixed(1)}px, 0)`;
            }
            if (Math.abs(tx - px) > .002 || Math.abs(ty - py) > .002) request();
        };
        const request = () => { if (!raf) raf = requestAnimationFrame(frame); };
        addEventListener('scroll', request, { passive: true });
        addEventListener('resize', measure);
        if ('ResizeObserver' in window) {
            let t = 0;
            new ResizeObserver(() => { clearTimeout(t); t = setTimeout(measure, 120); }).observe(document.body);
        }
        if (finePointer.matches) {
            addEventListener('pointermove', e => {
                if (scrollY > vh) return;
                tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / vh * 2 - 1; request();
            }, { passive: true });
        }
        reduced.addEventListener?.('change', () => {
            motion = !reduced.matches;
            root.classList.toggle('motion', motion);
            if (!motion) { for (const p of par) p.el.style.transform = ''; $$('[data-reveal], [data-stagger]').forEach(t => t.classList.add('in')); }
            request();
        });
        measure();
    }

    function init() {
        splitText();
        reveals();
        counters();
        pins();
        tilts();
        embers();
        scrollFx();
        requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('loaded')));
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
