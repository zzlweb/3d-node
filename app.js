const express = require('express');
const cors = require('cors');
const path = require('path');
const expressWs = require('express-ws');

const app = express();
const wsInstance = expressWs(app);

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, '../dist')));

// 路由
const tripoRouter = require('./routes/tripo');
const meshyRouter = require('./routes/meshy');

app.use('/api/tripo', tripoRouter);
app.use('/api/meshy', meshyRouter);

// 初始化 WebSocket 路由
if (tripoRouter.ws) {
  tripoRouter.ws(app);
}
if (meshyRouter.ws) {
  meshyRouter.ws(app);
}

// SPA 回退
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// 错误处理
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(error.status || 500).json({
    error: error.message || '内部服务器错误',
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
}); 