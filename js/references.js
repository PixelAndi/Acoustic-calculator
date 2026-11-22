/*
 * Acoustic Calculator – reference list and citation helper.
 *
 * In a page:  <cite data-ref="key"></cite>  (or data-ref="key1,key2")
 *             <ol class="ref-list" data-refs-auto></ol>
 * The script numbers the citations in the order they appear, links them to
 * the list, and writes the list. references.html shows all entries.
 *
 * Only entries that were checked against the publisher, a DOI or the
 * standard body are included. "verified" says what was checked.
 */
(function (root) {
  'use strict';

  /** @type {Record<string, {group:string, text:string, url?:string, doi?:string, note?:string}>} */
  const REFS = {};

  function link(r) {
    if (r.doi) return { href: 'https://doi.org/' + r.doi, label: 'doi:' + r.doi };
    if (r.url) return { href: r.url, label: r.url.replace(/^https?:\/\//, '').replace(/\/$/, '') };
    return null;
  }

  function entryNode(key, r, n) {
    const li = document.createElement('li');
    li.id = 'ref-' + key;
    if (n) li.value = n;
    li.append(document.createTextNode(r.text + ' '));
    const l = link(r);
    if (l) {
      const a = document.createElement('a');
      a.href = l.href;
      a.rel = 'noopener';
      a.target = '_blank';
      a.textContent = l.label;
      li.append(a);
    }
    if (r.note) {
      const s = document.createElement('span');
      s.className = 'ref-note';
      s.textContent = ' ' + r.note;
      li.append(s);
    }
    return li;
  }

  /** Number all <cite data-ref> in the page and fill the reference list. */
  function apply() {
    const order = [];
    const num = {};
    for (const c of document.querySelectorAll('cite[data-ref]')) {
      const keys = c.dataset.ref.split(',').map((k) => k.trim()).filter(Boolean);
      const parts = [];
      for (const k of keys) {
        if (!REFS[k]) {
          console.warn('Unknown reference', k);
          continue;
        }
        if (!num[k]) {
          order.push(k);
          num[k] = order.length;
        }
        parts.push(k);
      }
      c.textContent = '';
      c.classList.add('ref-cite');
      c.append('[');
      parts.forEach((k, i) => {
        if (i) c.append(', ');
        const a = document.createElement('a');
        a.href = '#ref-' + k;
        a.textContent = String(num[k]);
        a.title = REFS[k].text;
        c.append(a);
      });
      c.append(']');
    }
    for (const ol of document.querySelectorAll('ol[data-refs-auto]')) {
      ol.innerHTML = '';
      ol.classList.add('ref-list');
      order.forEach((k) => ol.append(entryNode(k, REFS[k], num[k])));
    }
    for (const box of document.querySelectorAll('[data-refs-all]')) {
      box.innerHTML = '';
      const groups = {};
      for (const [k, r] of Object.entries(REFS)) (groups[r.group] = groups[r.group] || []).push([k, r]);
      for (const [g, list] of Object.entries(groups)) {
        const h = document.createElement('h2');
        h.textContent = g;
        const ul = document.createElement('ul');
        ul.className = 'ref-list';
        list.forEach(([k, r]) => ul.append(entryNode(k, r)));
        box.append(h, ul);
      }
    }
  }

  function add(entries) {
    Object.assign(REFS, entries);
  }

  root.REFERENCES = { REFS, add, apply };
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', apply);
})(this);
