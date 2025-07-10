// 错误处理中间件
const errorHandler = (err, req, res, next) => {
  console.error('API错误:', err.message);
  
  // 如果是 axios 错误
  if (err.response) {
    return res.status(err.response.status || 500).json({
      error: err.message,
      details: err.response.data || null
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

  // 默认错误响应
  res.status(500).json({
    error: err.message || '服务器内部错误'
  });
};

module.exports = errorHandler;