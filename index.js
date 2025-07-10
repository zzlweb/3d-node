require('dotenv').config({ path: '.env.development' });
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// 导入路由
const tripoRouter = require('./routes/tripo');
const meshyRouter = require('./routes/meshy');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// 基础中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 添加请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.files || req.file) {
    console.log('文件上传请求:', {
      files: req.files,
      file: req.file
    });
  }
  next();
});

// 确保上传文件夹存在
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// 环境变量检查
const TRIPO_API_KEY = process.env.TRIPO_API_KEY;
const MESHY_API_KEY = process.env.MESHY_API_KEY;

if (!TRIPO_API_KEY) {
  console.error('缺少环境变量 TRIPO_API_KEY');
  process.exit(1);
}
if (!MESHY_API_KEY) {
  console.error('缺少环境变量 MESHY_API_KEY');
  process.exit(1);
}

// 默认路由
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: '3D模型生成服务API',
    version: '1.0.0',
    endpoints: {
      tripo: {
        base: '/api/tripo',
        routes: [
          { path: '/text-to-model', method: 'POST', desc: '文本转3D模型' },
          { path: '/create-task', method: 'POST', desc: '使用file_token创建模型生成任务' },
          { path: '/multiview-to-model', method: 'POST', desc: '多视角转3D模型' },
          { path: '/status/:taskId', method: 'GET', desc: '查询任务状态' },
          { path: '/task', method: 'GET', desc: '获取任务列表' },
          { path: '/task/:taskId', method: 'DELETE', desc: '取消任务' },
          { path: '/upload/sts', method: 'POST', desc: '上传图片到STS' },
          { path: '/test-upload', method: 'POST', desc: '测试文件上传' }
        ]
      },
      meshy: {
        base: '/api/meshy',
        routes: [
          { path: '/rig', method: 'POST', desc: '骨骼绑定' },
          { path: '/rig/status/:taskId', method: 'GET', desc: '查询绑定状态' }
        ]
      }
    }
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 路由
app.use('/api/tripo', tripoRouter);
app.use('/api/meshy', meshyRouter);

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    error: '未找到请求的资源',
    path: req.path
  });
});

// 错误处理中间件
app.use(errorHandler);

// 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务已启动: http://localhost:${PORT}`);
  console.log('查看API文档: http://localhost:${PORT}/');
});
