'use strict';

chrome.runtime.onInstalled.addListener(function (details) {
  console.log('previousVersion', details.previousVersion);
});

this.issueUrlRegExp = new RegExp(
        'https:\/\/github.com\/(.+)\/(.+)\/(issues|pull)\/(\\d+)(.*)');

this.stateLabels = [ 'doing', 'wait accepting', 'accepting', 'reopen', 'done' ];

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (tab.url.match(issueUrlRegExp)) {
    chrome.pageAction.show(tabId);
  }
});

this.GitHub = new GitHub(GitHubOptions);
console.log('localStorage' + localStorage.access_token);
this.GitHub.accessToken = localStorage.access_token;
