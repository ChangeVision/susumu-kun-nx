'use strict';

chrome.runtime.onInstalled.addListener(function (details) {
  console.log('previousVersion', details.previousVersion);
});

this.issueUrlRegExp = new RegExp(
        'https:\/\/github.com\/(.+)\/(.+)\/(issues|pull)\/(.+)');

this.stateLabels = [ 'doing', 'accepting', 'reopen', 'done' ];

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (tab.url.match(issueUrlRegExp)) {
    chrome.pageAction.show(tabId);
  }
});

this.GitHub = new GitHub(GitHubOptions);
var authorized = function(data){
  GitHub.accessToken = data.access_token;
};
GitHub.authorizeChromeApp().then(authorized);
