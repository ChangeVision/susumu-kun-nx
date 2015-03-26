'use strict';

console.log('open popup');

// use background.js variables
var bg = chrome.extension.getBackgroundPage();

var githubUrl;

function getGithubUrl() {
  chrome.windows.getCurrent(function(window) {
    chrome.tabs.getSelected(window.id, function(tab) {
      console.log(tab.url);
      githubUrl = tab.url;
    });
  });
}

function getGithubOwner() {
  return githubUrl.match(bg.issueUrlRegExp)[1];
}

function getGithubRepo() {
  return githubUrl.match(bg.issueUrlRegExp)[2];
}

function getGithubIssuesNumber() {
  return githubUrl.match(bg.issueUrlRegExp)[4];
}

var replaceLabel = function(putLabels) {
  return function(labels){
    for (var i in labels) {
      var labelName = labels[i].name;
      if ($.inArray(labelName, bg.stateLabels) === -1) {
        putLabels.push(labelName);
      }
    }
    var params = {
      'owner' : getGithubOwner(),
      'repo' : getGithubRepo(),
      'number' : getGithubIssuesNumber(),
      'labels' : putLabels
    };
    bg.GitHub.replaceLabels(params);
  };
};

var changeLabel = function(label){
  var putLabels = [ label ];
  var params = {
    'owner' : getGithubOwner(),
    'repo' : getGithubRepo(),
    'number' : getGithubIssuesNumber()
  };
  bg.GitHub.getLabels(params).then(replaceLabel(putLabels));
};

getGithubUrl();
$('div.btn-group').on('click', function(events) {
  console.log('buttons clicked');
  var label = $(events.target).children(':first-child').val();
  changeLabel(label);
});

var createTable = function(body){
  return function(name,desc){
    var row = $('<tr>').appendTo(body);
    var repo = $('<td>').appendTo(row);
    var githubUrl = 'https://github.com/' + name;
    $('<a>').attr('href',githubUrl).attr('target','_blank').text(name).appendTo(repo);
    $('<td>').text(desc).appendTo(row);
  };
};

var parseRepos = function(reposInfo){
  return function(repo){
    reposInfo[repo.full_name] = repo.description;
  };
};

var showRepos = function(data) {
  var reposBody = $('table#repos tbody');
  var reposInfo = {};
  $.map(data,parseRepos(reposInfo));
  $.each(reposInfo,createTable(reposBody));
};

