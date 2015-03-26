// License: MIT
'use strict';

/**
 * @fileoverview github-js aims to provide a complete, asynchronous client library for the GitHub API.
 *   For API details and how to use promises, see the JavaScript Promises articles.
 * @author kompiro (thanks shoito!)
 */

(function() {
  var GitHub = (function() {

    var self,
      clientId,
      clientSecret,
      redirectUri,
      scope = 'repo'; // @see {@link https://developer.github.com/v3/oauth/#scopes}

    /**
     * GitHub API client
     * @global
     * @class GitHub
     * @param {Object} [options] - API parameters
     * @param {String} [options.client_id] - client id
     * @param {String} [options.client_secret] - client secret
     * @param {String} [options.scope=repo] - scope
     * @param {String} [options.redirect_uri] - redirect uri
     * @param {String} [options.access_token] - access token
     * @see {@link https://developer.github.com/v3/oauth/}
     */
    function GitHubClass(options) {
      self = this;
      options = options || {};
      self.accessToken = options.access_token;

      clientId = options.client_id;
      clientSecret = options.client_secret;
      redirectUri = options.redirect_uri;
      scope = options.scope || scope;
    }

    GitHubClass.API_BASE_URL = 'https://api.github.com/';
    GitHubClass.OAUTH_BASE_URL = 'https://github.com/login/oauth/';

    var requestAccessToken = function(params) {
      return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.onload = function() {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            // { 'error': 'invalid_request', 'error_description': 'grant_type not found'}
            reject(JSON.parse(xhr.responseText));
          }
        };
        xhr.onerror = reject;

        xhr.open('POST', GitHubClass.OAUTH_BASE_URL + 'access_token');
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.timeout = self.timeout;
        xhr.send(params);
      });
    };

    var requestApi = function(url, method, params, options) {
      return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.onload = function() {
          if (xhr.status === 200) {
            resolve(JSON.parse(xhr.responseText));
          } else if (xhr.status === 400 || xhr.status === 401) {
            // 400; Bad Request
            // 400: WWW-Authenticate: Bearer error='invalid_request', error_description='Access token was not specified'
            // 401: WWW-Authenticate: Bearer error='invalid_token', error_description='Invalid access token'
            // 401: WWW-Authenticate: Bearer error='invalid_token', error_description='The access token expired'
            // 401: WWW-Authenticate: Bearer error='invalid_scope'
            var authMessage = (xhr.getResponseHeader('WWW-Authenticate') || ''),
              errorMatch = (authMessage.match(/error='(\w+)'/) || []),
              errorDescriptionMatch = (authMessage.match(/error_description='(\w+)'/) || []),
              error = (errorMatch.length > 1) ? errorMatch[1] : xhr.statusText,
              errorDescription = (errorDescriptionMatch.length > 1) ? errorDescriptionMatch[1] : '';
            reject({'status': xhr.status, 'error': error, 'error_description': errorDescription});
          } else {
            reject({'status': xhr.status, 'error': xhr.statusText, 'error_description': 'An error has occurred while requesting api'});
          }
        };
        xhr.onerror = reject;

        xhr.open(method, url);
        if (options && options['Content-Type']) {
          xhr.setRequestHeader('Content-Type', options['Content-Type']);
        }
        xhr.setRequestHeader('Authorization', 'token ' + encodeURIComponent(self.accessToken));

        xhr.timeout = self.timeout;
        xhr.send(params);
      });
    };

    /**
     * Starts an auth flow at the GitHub oauth2 URL.
     * @memberof GitHub
     * @method
     * @param {Object} [options] - oAuth2 parameters
     * @param {String} [options.client_id] - client id
     * @param {String} [options.scope] - scope
     * @param {String} [options.redirect_uri] - redirect uri
     * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
     */
    GitHubClass.prototype.authorizeChromeApp = function(options) {
      options = options || {};
      return new Promise(function(resolve, reject) {
        if (!(chrome && chrome.identity)) {
          reject(new Error('chrome.identity API is unsupported'));
          return;
        }

        var authorizeUrl = GitHubClass.OAUTH_BASE_URL + 'authorize?client_id=' + encodeURIComponent(clientId || options.client_id) +
        '&redirect_uri=' + encodeURIComponent(redirectUri || options.redirect_uri) +
        '&scope=' + encodeURIComponent(scope || options.scope) + '&response_type=code';
        console.log(authorizeUrl);
        chrome.identity.launchWebAuthFlow(
          {'url': authorizeUrl, 'interactive': true},
          function(responseUrl) {
            if (typeof responseUrl === 'undefined') {
              reject(new Error('Cannot get response url'));
              return;
            }

            var code = responseUrl.match(/code=(.+)/)[1];
            if (typeof code === 'undefined') {
              reject(new Error('authorization code is required'));
              return;
            }

            self.getAccessTokenUsingAuthorizationCode(code).then(function(data) {
              resolve(data);
            }, function(err) {
              reject(err);
            });
          }
        );
      });
    };

    /**
     * Check if this instance has the access token and the refresh token
     * @memberof GitHub
     * @method
     * @return {Boolean} - Returns true if this instance has the access token and the refresh token
     */
    GitHubClass.prototype.hasToken = function() {
      return !!self.accessToken && !!self.refreshToken;
    };

    /**
     * Removes your access token from this instance
     * @memberof GitHub
     * @method
     */
    GitHubClass.prototype.clearToken = function() {
      self.accessToken = null;
      self.refreshToken = null;
    };

    /**
     * Validate your access token
     * @memberof GitHub
     * @method
     * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
     */
    GitHubClass.prototype.validateAccessToken = function() {
      return self.getMyProfile();
    };

    /**
     * Get access token using authorization code
     * @memberof GitHub
     * @method
     * @param {Object} [options] - oAuth2 parameters
     * @param {String} [options.client_id] - client id
     * @param {String} [options.client_secret] - client secret
     * @param {String} [options.scope] - scope
     * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
     * @see {@link https://developer.nulab-inc.com/docs/typetalk/auth#client}
     */
    GitHubClass.prototype.getAccessTokenUsingClientCredentials = function(options) {
      options = options || {};
      var param = 'client_id=' + encodeURIComponent(clientId || options.client_id) +
        '&client_secret=' + encodeURIComponent(clientSecret || options.client_secret) +
        '&grant_type=client_credentials' +
        '&scope=' + encodeURIComponent(scope || options.scope);
      return requestAccessToken(param);
    };

    /**
     * Redirect users to request GitHub access
     * @memberof GitHub
     * @method
     * @param {Object} [options] - oAuth2 parameters
     * @param {String} [options.client_id] - client id
     * @param {String} [options.scope] - scope
     * @param {String} [options.redirect_uri] - redirect uri
     * @see {@link https://developer.nulab-inc.com/docs/typetalk/auth#code}
     */
    GitHubClass.prototype.requestAuthorization = function(options) {
      options = options || {};
      var param = 'client_id=' + encodeURIComponent(clientId || options.client_id) +
        '&redirect_uri=' + encodeURIComponent(redirectUri || options.redirect_uri) +
        '&scope=' + encodeURIComponent(scope || options.scope) +
        '&response_type=code';
      location.href = GitHubClass.OAUTH_BASE_URL + 'authorize?' + param;
    };

    /**
     * Get an access token using authorization code
     * @memberof GitHub
     * @method
     * @param {Object} [options] - oAuth2 parameters
     * @param {String} [options.client_id] - client id
     * @param {String} [options.client_secret] - client secret
     * @param {String} [options.redirect_uri] - redirect uri
     * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
     * @see {@link https://developer.nulab-inc.com/docs/typetalk/auth#code}
     */
    GitHubClass.prototype.getAccessTokenUsingAuthorizationCode = function(code, options) {
      options = options || {};
      var param = 'client_id=' + encodeURIComponent(clientId || options.client_id) +
        '&client_secret=' + encodeURIComponent(clientSecret || options.client_secret) +
        '&redirect_uri=' + encodeURIComponent(redirectUri || options.redirect_uri) +
        '&grant_type=authorization_code' +
        '&code=' + encodeURIComponent(code);
      return requestAccessToken(param);
    };

    /**
     * Get an access token using authorization code
     * @memberof GitHub
     * @method
     * @param {Object} [options] - oAuth2 parameters and refresh token
     * @param {String} [options.client_id] - client id
     * @param {String} [options.client_secret] - client secret
     * @param {String} [options.refresh_token] - refresh token
     * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
     * @see {@link https://developer.nulab-inc.com/docs/typetalk/auth#refresh}
     */
    GitHubClass.prototype.refreshAccessToken = function(options) {
      options = options || {};
      var param = 'client_id=' + encodeURIComponent(clientId || options.client_id) +
        '&client_secret=' + encodeURIComponent(clientSecret || options.client_secret) +
        '&grant_type=refresh_token' +
        '&refresh_token=' + encodeURIComponent(self.refreshToken || options.refresh_token);
      return requestAccessToken(param);
    };

    /**
     * Get my repos
     * @memberof GitHub
     * @method GET
     * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
     * @see {@link https://developer.github.com/v3/repos/#list-user-repositories}
     */
    GitHubClass.prototype.getRepos = function() {
      return requestApi(GitHubClass.API_BASE_URL + 'user/repos', 'GET', null);
    };

    /**
     * Get labels from an issue
     * @memberof GitHub
     * @param {Object} [options] - issue or pull request parameter
     * @param {Number} [options.issue_id] - issue id
     * @param {String} [options.owner] - repository owner
     * @param {String} [options.repo] - repository name
     * @method POST
     * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
     * @see {@link https://developer.github.com/v3/issues/labels/#add-labels-to-an-issue}
     */
    GitHubClass.prototype.getLabels = function(options) {
      var url = GitHubClass.API_BASE_URL + 'repos/' +
        options.owner + '/' +
        options.repo + '/' +
        'issues/' +
        options.number + '/' +
        'labels';
      return requestApi(url, 'GET', null);
    };

    /**
     * Add label to an issue
     * @memberof GitHub
     * @param {Object} [options] - issue or pull request parameter
     * @param {Number} [options.issue_id] - issue id
     * @param {String} [options.owner] - repository owner
     * @param {String} [options.repo] - repository name
     * @param {String} [options.label] - label
     * @method POST
     * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
     * @see {@link https://developer.github.com/v3/issues/labels/#add-labels-to-an-issue}
     */
    GitHubClass.prototype.addLabel = function(options) {
      var url = GitHubClass.API_BASE_URL + 'repos/' +
        options.owner + '/' +
        options.repo + '/' +
        'issues/' +
        options.number + '/' +
        'labels';
      var params = [
        options.label
      ];
      return requestApi(url, 'POST', JSON.stringify(params), {'Content-Type' : 'application/json;charset=UTF-8'});
    };

    /**
     * Delete label to an issue
     * @memberof GitHub
     * @param {Object} [options] - issue or pull request parameter
     * @param {Number} [options.issue_id] - issue id
     * @param {String} [options.owner] - repository owner
     * @param {String} [options.repo] - repository name
     * @param {String}  [options.label] - label
     * @method DELETE
     * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
     * @see {@link https://developer.github.com/v3/issues/labels/#remove-a-label-from-an-issue}
     */
    GitHubClass.prototype.deleteLabel = function(options) {
      var url = GitHubClass.API_BASE_URL + 'repos/' +
        options.owner + '/' +
        options.repo + '/' +
        'issues/' +
        options.number + '/' +
        'labels';
      var params = options.label;
      return requestApi(url, 'DELETE', JSON.stringify(params), {'Content-Type' : 'application/json;charset=UTF-8'});
    };

    /**
     * Replace labels to an issue
     * @memberof GitHub
     * @param {Object} [options] - issue or pull request parameter
     * @param {Number} [options.issue_id] - issue id
     * @param {String} [options.owner] - repository owner
     * @param {String} [options.repo] - repository name
     * @param {Array}  [options.labels] - labels
     * @method PUT
     * @return {Promise} promise object - It will resolve with `response` data or fail with `error` object
     * @see {@link https://developer.github.com/v3/issues/labels/#replace-all-labels-for-an-issue}
     */
    GitHubClass.prototype.replaceLabels = function(options) {
      var url = GitHubClass.API_BASE_URL + 'repos/' +
        options.owner + '/' +
        options.repo + '/' +
        'issues/' +
        options.number + '/' +
        'labels';
      var params = options.labels;
      return requestApi(url, 'PUT', JSON.stringify(params), {'Content-Type' : 'application/json;charset=UTF-8'});
    };

    return GitHubClass;
  })();

  if (typeof module !== 'undefined') {
    module.exports = GitHub;
  } else {
    this.GitHub = GitHub;
  }
}).call(this);
