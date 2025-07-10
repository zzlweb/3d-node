// 错误处理中间件
const errorHandler = (err, req, res, next) => {
  console.error('API错误详情:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });
  
  // 如果是 axios 错误
  if (err.response) {
    return res.status(err.response.status || 500).json({
      error: err.message,
      details: err.response.data || null,
      requestInfo: {
        url: req.url,
        method: req.method
      }
    });
  }

  // 如果是文件上传错误
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: '文件大小超出限制'
    });
  }

  // 如果是验证错误
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: '请求参数验证失败',
      details: err.details
    });
  }

  // TypeError 通常是访问 undefined 属性
  if (err.name === 'TypeError' && err.message.includes('Cannot read properties of undefined')) {
    return res.status(400).json({
      error: '请求数据格式错误',
      message: '某个必需的数据字段未定义',
      details: err.message,
      requestInfo: {
        url: req.url,
        method: req.method,
        body: req.body,
        params: req.params
      }
    });
  }

  // 默认错误响应
  res.status(500).json({
    error: err.message || '服务器内部错误',
    timestamp: new Date().toISOString(),
    requestInfo: {
      url: req.url,
      method: req.method
    }
  });
};

module.exports = errorHandler;