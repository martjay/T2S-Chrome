const defaults = { enabled: true, mode: 's2t' };

function load() {
  chrome.storage.sync.get(defaults, ({ enabled, mode }) => {
    document.getElementById('enabled').checked = !!enabled;
    document.getElementById('mode').value = mode;
  });
}

function save() {
  const enabled = document.getElementById('enabled').checked;
  const mode = document.getElementById('mode').value;
  chrome.storage.sync.set({ enabled, mode });
}

document.addEventListener('DOMContentLoaded', () => {
  load();
  document.getElementById('enabled').addEventListener('change', save);
  document.getElementById('mode').addEventListener('change', save);
});


