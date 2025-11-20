const path = require('path');

module.exports = {
  // ... other webpack config options ...
  resolve: {
    fallback: {
      "vm": false
    }
  }
}; 