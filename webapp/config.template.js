config = {};

config.salt = '';

config.processTitle = 'scribe';

config.environment = 'development';

config.mongodb_dsn = 'mongodb://127.0.0.1:27017/scribe';

config.google_api_key = '';

config.memcached = {
  secret: '',
  key: 'scribe',
  hosts: ['127.0.0.1:11211'],
  force: false
};


module.exports = config;
