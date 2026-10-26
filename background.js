/* 内容脚本无法直接打开扩展页面，这里转发一下 */
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message && message.type === 'lg-open-options') {
    try {
      chrome.runtime.openOptionsPage();
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({ ok: false });
    }
  }
});
