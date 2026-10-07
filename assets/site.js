const PROFILES = {
    Night: { img: 'assets/cmp-night.webp', vib: 65, sat: 100, bri: 54, con: 50, gam: 1.6, temp: -10 },
    Snow: { img: 'assets/cmp-snow.webp', vib: 60, sat: 105, bri: 46, con: 56, gam: 0.95, temp: 10 },
    Desert: { img: 'assets/cmp-desert.webp', vib: 75, sat: 115, bri: 48, con: 55, gam: 1, temp: -15 }
};
(() => {
    const box = document.getElementById('compare');
    if (!box) return;
    const view = box.querySelector('.cmp-view'), before = box.querySelector('.before'), after = box.querySelector('.after');
    const cache = {};
    function grade(p, src, dst) {
        const t = p.temp / 100, tg = t >= 0 ? [1, 1 - 0.1 * t, 1 - 0.25 * t] : [1 + 0.25 * t, 1 + 0.1 * t, 1];
        const k = 1 + (p.con - 50) / 100, b = (p.bri - 50) / 100, sat = p.sat / 100 * (1 + (p.vib - 50) / 100);
        const lut = [0, 1, 2].map(c => Uint8ClampedArray.from({ length: 256 }, (_, i) => {
            const y = ((Math.pow(i / 255, 1 / p.gam) - 0.5) * k + 0.5 + b) * tg[c];
            return Math.round(Math.max(0, Math.min(1, y)) * 255);
        }));
        const d = src.data, o = dst.data;
        for (let i = 0; i < d.length; i += 4) {
            const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
            for (let c = 0; c < 3; c++) o[i + c] = lut[c][Math.max(0, Math.min(255, Math.round(l + (d[i + c] - l) * sat)))];
            o[i + 3] = 255;
        }
    }
    function show(name) {
        const p = PROFILES[name];
        for (const b of box.querySelectorAll('.cmp-tabs button')) b.classList.toggle('active', b.dataset.p === name);
        document.getElementById('cmp-note').textContent = `${name} preset: vibrance ${p.vib}%, saturation ${p.sat}%, brightness ${p.bri}%, contrast ${p.con}%, gamma ${p.gam.toFixed(2)}, ${p.temp === 0 ? 'neutral' : p.temp < 0 ? 'cooler' : 'warmer'}. Make your own in the app.`;
        const draw = img => {
            const w = Math.min(1600, img.naturalWidth), h = Math.round(w * img.naturalHeight / img.naturalWidth);
            for (const c of [before, after]) { c.width = w; c.height = h; }
            const bx = before.getContext('2d', { willReadFrequently: true });
            bx.drawImage(img, 0, 0, w, h);
            const src = bx.getImageData(0, 0, w, h), out = after.getContext('2d').createImageData(w, h);
            grade(p, src, out);
            after.getContext('2d').putImageData(out, 0, 0);
            view.style.aspectRatio = `${w} / ${h}`;
        };
        if (cache[p.img]) return draw(cache[p.img]);
        const img = new Image();
        img.onload = () => { cache[p.img] = img; draw(img); };
        img.src = p.img;
    }
    const range = box.querySelector('.cmp-range');
    range.oninput = () => view.style.setProperty('--pos', `${range.value}%`);
    for (const b of box.querySelectorAll('.cmp-tabs button')) b.onclick = () => show(b.dataset.p);
    const probe = new Image();
    probe.onload = () => { box.hidden = false; document.getElementById('compare-fallback').remove(); show('Night'); };
    probe.src = PROFILES.Night.img;
})();

const DOWNLOAD_URL = '';
const BUY_URL = '';
const PRICE = '';

for (const a of document.querySelectorAll('[data-download]')) {
    if (DOWNLOAD_URL) a.href = DOWNLOAD_URL;
    else if (a.closest('.plan, .cta')) { a.textContent = 'Coming soon'; a.setAttribute('aria-disabled', 'true'); }
}
for (const a of document.querySelectorAll('[data-buy]')) {
    if (BUY_URL) a.href = BUY_URL;
    else { a.textContent = 'Coming soon'; a.setAttribute('aria-disabled', 'true'); }
}
for (const el of document.querySelectorAll('[data-price]')) el.textContent = PRICE || 'Soon';
for (const el of document.querySelectorAll('[data-year]')) el.textContent = new Date().getFullYear();
