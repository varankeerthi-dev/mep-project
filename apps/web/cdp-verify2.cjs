/* Re-verify edge-case fixes over CDP */
const { connect } = require('./cdp-harness.cjs');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const { send, evalJs } = await connect();
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://localhost:5173/manufacturing/boms/edit?id=9ad654f4-deea-410a-a924-28566bced173' });
  await wait(6000);
  await evalJs(`
    window.__h = {
      footer(label) {
        const spans = [...document.querySelectorAll('span')];
        const s = spans.find(x => x.textContent.trim().startsWith(label));
        return s ? (s.nextElementSibling ? s.nextElementSibling.textContent : null) : null;
      },
      inputByLabel(t) {
        const lbl = [...document.querySelectorAll('label')].find(l => l.textContent.trim().startsWith(t));
        return lbl ? lbl.parentElement.querySelector('input') : null;
      },
      setInput(el, v) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      },
      rows() { return [...document.querySelectorAll('input[type="number"]')].filter(i => i.closest('td')); },
      sleep: ms => new Promise(r => setTimeout(r, ms))
    };
    'ok'
  `);

  // setup: qty 2, cost 100, open tray
  await evalJs(`(() => { const r = window.__h.rows().find(i => !i.readOnly); window.__h.setInput(r, '2'); return 'ok'; })()`);
  await evalJs(`(async () => {
    document.querySelector('.action-menu-container button').click();
    await window.__h.sleep(300);
    [...document.querySelectorAll('.action-menu-portal button')].find(b => b.textContent.includes('Costing & Details')).click();
    await window.__h.sleep(400);
    window.__h.setInput(window.__h.inputByLabel('Unit Cost'), '100');
    return 'ok';
  })()`);
  await wait(400);

  console.log('F1 baseline total (expect 200):', await evalJs(`window.__h.footer('Total Material Cost')`));

  // FIX1: negative cost clamped
  await evalJs(`window.__h.setInput(window.__h.inputByLabel('Unit Cost'), '-50')`);
  await wait(300);
  console.log('FIX1 negative cost -> clamped, total (expect 200):', await evalJs(`window.__h.footer('Total Material Cost')`));

  // FIX2: scrap 150 clamped to 100, yield 0
  await evalJs(`window.__h.setInput(window.__h.inputByLabel('Scrap'), '150')`);
  await wait(300);
  console.log('FIX2 scrap 150 -> stored/clamped:', await evalJs(`(window.__h.inputByLabel('Scrap')||{}).value`),
    '| yield (expect 0):', await evalJs(`(window.__h.inputByLabel('Yield')||{}).value`));

  // FIX3: yield read-only (independent edit must not stick)
  const ro = await evalJs(`(() => { const el = window.__h.inputByLabel('Yield'); window.__h.setInput(el, '55'); return 'readOnly=' + el.readOnly + ', value=' + el.value; })()`);
  console.log('FIX3 yield read-only:', ro);

  // FIX5: footer metric replaced
  console.log('FIX5 Material Lines metric:', await evalJs(`window.__h.footer('Material Lines')`),
    '| old ops metric present:', await evalJs(`window.__h.footer('Est. Production Time') !== null`));

  // FIX6: % toggle clamps to 100 (qty 2 / output 1 would derive 200)
  const pct = await evalJs(`(async () => {
    const btn = [...document.querySelectorAll('button')].find(b => b.title === '% of batch');
    btn.click();
    await window.__h.sleep(300);
    const pctInput = [...document.querySelectorAll('input')].find(i => i.closest('td') && i.type === 'number' && i.value !== '' && i.readOnly !== true && i.closest('td').querySelector('div') && !i.closest('td').textContent.includes('='));
    const all = [...document.querySelectorAll('td input[type=number]')].map(i => i.value);
    return 'percentInputs=' + JSON.stringify(all);
  })()`);
  console.log('FIX6 % toggle clamp:', pct, '(expect 100, not 200)');

  // scrap back to sane value for state cleanliness (not saved anyway)
  process.exit(0);
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });
