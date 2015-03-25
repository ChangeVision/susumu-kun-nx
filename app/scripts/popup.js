'use strict';

console.log('open popup');

chrome.identity.launchWebAuthFlow({
  'url':'https://github.com/login/oauth/authorize?client_id=eae84108cca55862ee54',
  'interactive':true
},
  function(redirect_url){
    console.log(redirect_url);
  })
