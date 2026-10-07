const BUY_URL = '';
const PRICE = '';
for (const a of document.querySelectorAll('[data-buy]')) {
    if (BUY_URL) a.href = BUY_URL;
    else { a.setAttribute('aria-disabled', 'true'); if (!a.querySelector('[data-price]')) a.textContent = 'Coming soon'; else a.textContent = 'Coming soon'; }
}
for (const el of document.querySelectorAll('[data-price]')) el.textContent = PRICE || 'Soon';
for (const el of document.querySelectorAll('[data-year]')) el.textContent = new Date().getFullYear();
const io = 'IntersectionObserver' in window && new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
for (const el of document.querySelectorAll('.reveal')) io ? io.observe(el) : el.classList.add('in');
