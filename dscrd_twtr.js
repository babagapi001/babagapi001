(function () {
  'use strict';

  const MEMBER_LIST_WRAPPER_SELECTOR = '[aria-label="Members"]';
  const MEMBER_LIST_ITEM_SELECTOR = '[aria-label="Members"] [role="listitem"]';
  const AVATAR_SELECTOR = 'div.avatar__75742.clickable__75742[role="button"]';
  const PROFILE_MODAL_SELECTOR = 'div.user-profile-modal';
  const SOCIAL_X_SELECTOR = 'a[href*="x.com"], a[href*="twitter.com"]';

  const sleep = ms => new Promise(res => setTimeout(res, ms));
  let scanning = false;
  const scanned = new Set();
  const results = [];

  function createModal() {
    const modal = document.createElement('div');
    modal.id = 'scan-modal';
    Object.assign(modal.style, {
      position: 'fixed',
      top: '20px',
      left: '20px',
      padding: '15px',
      background: '#2c2f33',
      color: 'white',
      zIndex: 9999,
      display: 'none',
      flexDirection: 'column',
      gap: '10px',
      borderRadius: '8px',
      boxShadow: '0 0 10px black',
      width: '360px',
      maxHeight: '90vh',
      overflow: 'auto'
    });

    const btn = document.createElement('button');
    btn.id = 'scan-toggle';
    btn.innerText = '▶️ Start Scan';
    Object.assign(btn.style, {
      backgroundColor: '#7289da',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      padding: '8px 12px',
      cursor: 'pointer',
      fontSize: '14px',
    });

    const counter = document.createElement('div');
    counter.id = 'scan-counter';
    counter.innerText = 'Found: 0';
    counter.style.fontSize = '14px';

    btn.addEventListener('click', () => {
      scanning = !scanning;
      btn.innerText = scanning ? '⏹️ Stop Scan' : '▶️ Start Scan';
      if (scanning) {
        startContinuousScan();
      }
    });

    const resultsPanel = document.createElement('div');
    resultsPanel.id = 'scan-results';
    Object.assign(resultsPanel.style, {
      marginTop: '10px',
      background: '#23272a',
      padding: '10px',
      borderRadius: '6px',
      fontSize: '13px',
      fontFamily: 'monospace',
      whiteSpace: 'pre-wrap',
      userSelect: 'text',
      cursor: 'text',
      maxHeight: '60vh',
      overflowY: 'auto',
      display: 'block',
    });

    modal.appendChild(btn);
    modal.appendChild(counter);
    modal.appendChild(resultsPanel);
    document.body.appendChild(modal);
  }

  function updateCounter(count) {
    const counter = document.getElementById('scan-counter');
    if (counter) counter.innerText = `Found: ${count}`;
  }

  function appendToResultPanel(username, link) {
    const panel = document.getElementById('scan-results');
    if (!panel) return;

    const existing = [...panel.children].find(child => child.dataset.username === username);
    if (existing) return; // avoid duplicates in UI

    const entry = document.createElement('div');
    entry.textContent = `${username} - ${link}`;
    entry.dataset.username = username;
    entry.style.whiteSpace = 'pre-wrap';
    entry.style.userSelect = 'text';
    entry.style.cursor = 'pointer';
    entry.title = 'Click to copy username';
    entry.style.padding = '2px 4px';
    entry.style.border = '1px solid transparent';
    entry.style.borderRadius = '4px';

    entry.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(username);
        entry.title = 'Copied!';
        entry.style.border = '1px solid red';
        setTimeout(() => {
          entry.title = 'Click to copy username';
        }, 1000);
      } catch {
        alert('Clipboard write failed.');
      }
    });

    panel.appendChild(entry);
    updateCounter(panel.children.length);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Insert') {
      const modal = document.getElementById('scan-modal');
      if (modal) modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
    }
  });

  function virtualClickToClose() {
    const elem = document.elementFromPoint(5, 5);
    if (elem) {
      ['mousedown', 'mouseup', 'click'].forEach(event =>
        elem.dispatchEvent(new MouseEvent(event, { bubbles: true }))
      );
    }
  }

  async function scanMember(member) {
    if (!scanning) return;

    member.scrollIntoView({ behavior: "smooth", block: "center" });
    member.click();
    await sleep(300);

    const avatar = document.querySelector(AVATAR_SELECTOR) || member.querySelector(AVATAR_SELECTOR);
    if (!avatar) return;

    avatar.click();
    await sleep(600);

    const modal = [...document.querySelectorAll(PROFILE_MODAL_SELECTOR)].pop();
    if (!modal) return;

    const xLink = modal.querySelector(SOCIAL_X_SELECTOR);
    const usernameSpan = modal.querySelector('span[class*="userTagUsername"]');
    const username = usernameSpan?.innerText?.trim();

    if (!username || scanned.has(username)) {
      virtualClickToClose();
      return;
    }

    const panel = document.getElementById('scan-results');
    const alreadyListed = [...panel.children].some(el => el.dataset.username === username);
    if (alreadyListed) {
      scanned.add(username);
      virtualClickToClose();
      return;
    }

    const isValidX = xLink && /^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/[a-zA-Z0-9_]{1,15}$/.test(xLink.href);
    if (isValidX) {
      scanned.add(username);
      results.push(`${username} - ${xLink.href}`);
      appendToResultPanel(username, xLink.href);
    }

    virtualClickToClose();
    await sleep(300);
  }

  async function startContinuousScan() {
    const container = document.querySelector(MEMBER_LIST_WRAPPER_SELECTOR);
    if (!container) {
      console.log("❌ Member list not found.");
      return;
    }

    let seenKeys = new Set();

    while (scanning) {
      const members = [...document.querySelectorAll(MEMBER_LIST_ITEM_SELECTOR)];

      for (const member of members) {
        const key = member.innerText.trim();
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          await scanMember(member);
          await sleep(300);
        }
      }

      container.scrollTop += 400;
      await sleep(800);
    }

    console.log("⛔ Scanning stopped.");
  }

  const overrideNoteModule = () => {
    const patch = () => {
      const chunk = window.webpackChunkdiscord_app?.find(i => i?.[1]);
      if (!chunk) return;

      for (const mod of Object.values(chunk[1])) {
        try {
          const temp = {};
          mod({}, temp, {});
          if (temp.exports?.getNote) {
            temp.exports.getNote = () => Promise.resolve(null);
            temp.exports.updateNote = () => Promise.resolve(null);
            break;
          }
        } catch (e) {}
      }
    };

    const wait = setInterval(() => {
      if (window.webpackChunkdiscord_app?.length) {
        clearInterval(wait);
        patch();
      }
    }, 300);
  };

  createModal();
  overrideNoteModule();
})();
