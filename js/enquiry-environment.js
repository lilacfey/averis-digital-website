(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.AverisEnquiryEnvironment = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return {
    isPreviewHost: function (hostname) {
      return String(hostname || '').toLowerCase() === 'lilacfey.github.io';
    },
    enquiryEndpoint: function (pageUrl) {
      return new URL('api/enquiry.php', pageUrl).href;
    }
  };
}));
