/* BOM editor costing verification over CDP — evidence runner */
const { connect } = require('./cdp-harness.cjs');
const fs = require('fs');

const BOM_ID = '9ad654f4-deea-410a-a924-28566bced173'; // BOM-0002

const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const { send, evalJs } = await connect();
  console.log('STEP 0: connected to', 'tab');
  await send('Page.enable');
  await send('Page.navigate', { url: `http://localhost:5173/manufacturing/boms/edit?id=${BOM_ID}` });
  await wait(6000);
  console.log('URL NOW:', await evalJs('location.href'));
  console.log('LOADED:', await evalJs(`document.body.innerText.includes('Materials')`));

  // helpers injected into page
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
      rows() {
        return [...document.querySelectorAll('input[type="number"]')].filter(i => i.closest('td'));
      },
      sleep: ms => new Promise(r => setTimeout(r, ms))
    };
    'ok'
  `);

  // T1 — baseline totals from DB-loaded data
  const t1 = await evalJs(`JSON.stringify({
    total: window.__h.footer('Total Material Cost'),
    perUnit: window.__h.footer('Cost per Unit'),
    ops: window.__h.footer('Est. Production Time'),
    numQtyInputs: window.__h.rows().length
  })`);
  console.log('T1 BASELINE (DB state):', t1);

  // T2 — set first material qty=2, open costing tray, set unit cost=100 -> expect +200 in total
  const qtySet = await evalJs(`(() => {
    const rows = window.__h.rows();
    const qtyInput = rows.find(i => !i.readOnly);
    if (!qtyInput) return 'no-qty-input';
    window.__h.setInput(qtyInput, '2');
    return 'qty-set:' + qtyInput.value;
  })()`);
  console.log('T2a set qty:', qtySet);

  const openTray = await evalJs(`(async () => {
    const menuBtn = document.querySelector('.action-menu-container button');
    if (!menuBtn) return 'no-menu';
    menuBtn.click();
    await window.__h.sleep(300);
    const item = [...document.querySelectorAll('.action-menu-portal button')].find(b => b.textContent.includes('Costing & Details'));
    if (!item) return 'no-costing-item';
    item.click();
    await window.__h.sleep(400);
    return 'tray-open';
  })()`);
  console.log('T2b tray:', openTray);

  const costSet = await evalJs(`(() => {
    const el = window.__h.inputByLabel('Unit Cost');
    if (!el) return 'no-unit-cost-input';
    window.__h.setInput(el, '100');
    return 'cost-set:' + el.value;
  })()`);
  console.log('T2c unit cost:', costSet);
  await wait(500);
  console.log('T2d EXPECT total = 2 x 100 = 200.00 | ACTUAL total:', await evalJs(`window.__h.footer('Total Material Cost')`),
    '| perUnit:', await evalJs(`window.__h.footer('Cost per Unit')`));

  // T3 — scrap/yield binding: set Scrap 20 -> yield must show 80
  const scrap = await evalJs(`(() => {
    const el = window.__h.inputByLabel('Scrap');
    if (!el) return 'no-scrap';
    window.__h.setInput(el, '20');
    return 'scrap-set';
  })()`);
  await wait(300);
  console.log('T3a scrap set:', scrap, '| yield input now:', await evalJs(`(window.__h.inputByLabel('Yield')||{}).value`),
    '| EXPECT 80');

  // T4 — yield independent edit breaks consistency (evidence)
  const yieldEdit = await evalJs(`(() => {
    const el = window.__h.inputByLabel('Yield');
    if (!el) return 'no-yield';
    window.__h.setInput(el, '55');
    return 'yield-set:' + el.value;
  })()`);
  await wait(300);
  console.log('T4 EDGE yield manually 55 while scrap 20 -> inconsistent pair, evidence:', yieldEdit,
    '| scrap still:', await evalJs(`(window.__h.inputByLabel('Scrap')||{}).value`));

  // T5 — negative unit cost accepted?
  const neg = await evalJs(`(() => {
    const el = window.__h.inputByLabel('Unit Cost');
    window.__h.setInput(el, '-50');
    return 'set:' + el.value;
  })()`);
  await wait(400);
  console.log('T5 EDGE negative cost:', neg, '| total now:', await evalJs(`window.__h.footer('Total Material Cost')`));

  // T6 — scrap 150 accepted? yield goes negative?
  const bigScrap = await evalJs(`(() => {
    const el = window.__h.inputByLabel('Scrap');
    window.__h.setInput(el, '150');
    return 'scrap150';
  })()`);
  await wait(300);
  console.log('T6 EDGE scrap 150 -> yield shows:', await evalJs(`(window.__h.inputByLabel('Yield')||{}).value`),
    '(EXPECT clamp to 0 if guarded)');

  // T7 — clear unit cost -> fallback 0 contribution
  const cleared = await evalJs(`(() => {
    const el = window.__h.inputByLabel('Unit Cost');
    window.__h.setInput(el, '');
    return 'cleared:' + JSON.stringify(el.value);
  })()`);
  await wait(400);
  console.log('T7 FALLBACK empty cost -> total:', await evalJs(`window.__h.footer('Total Material Cost')`), cleared);

  // T8 — % basis row: toggle % side, set 50, with output qty known
  const pct = await evalJs(`(async () => {
    const outEl = [...document.querySelectorAll('input')].find(i => i.type === 'number' && i.closest('.form-split-fields'));
    const outputQty = outEl ? outEl.value : '?';
    const pctBtn = [...document.querySelectorAll('button')].find(b => b.title === '% of batch');
    if (!pctBtn) return 'no-pct-btn';
    pctBtn.click();
    await window.__h.sleep(300);
    const pctInput = [...document.querySelectorAll('input')].find(i => i.placeholder === '0' && i.closest('td') && i.value !== '' && i.value !== '0');
    return 'toggled, outputQty=' + outputQty + ', percentInputValue=' + (pctInput ? pctInput.value : 'n/a');
  })()`);
  console.log('T8 % toggle:', pct);

  // T9 — reload: DB persistence + wastage fallback (nothing was saved)
  await send('Page.navigate', { url: `http://localhost:5173/manufacturing/boms/edit?id=${BOM_ID}` });
  await wait(6000);
  console.log('T9 RELOAD (nothing saved) total back to DB state:', await evalJs(`window.__h.footer('Total Material Cost')`),
    '| ops metric:', await evalJs(`window.__h.footer('Est. Production Time')`),
    '| material rows:', await evalJs(`window.__h.rows().length`));

  // Screenshot evidence
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('C:/Users/admin/mep-project/apps/web/cdp-bom-evidence.png', Buffer.from(shot.result.data, 'base64'));
  console.log('SCREENSHOT saved: cdp-bom-evidence.png');
  process.exit(0);
})().catch(e => { console.error('RUNNER FAIL:', e.message); process.exit(1); });
