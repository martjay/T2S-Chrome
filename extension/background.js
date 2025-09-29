chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ enabled: true, mode: 's2t' }, (data) => {
    chrome.storage.sync.set(data);
  });
});


