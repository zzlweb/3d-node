require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// 导入路由
const tripoRouter = require('./routes/tripo');
const meshyRouter = require('./routes/meshy');

const app = express();

// Vercel 环境检测
const isVercel = process.env.VERCEL === '1';

// 专门为API服务设计的CORS配置
const corsOptions = {
  origin: function (origin, callback) {
    // 开发环境允许的地址
    const developmentOrigins = [
      'http://localhost:3000',
      'http://localhost:5173', // Vite 开发服务器
      'http://localhost:4173', // Vite 预览服务器
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
    ];
    
    // 生产环境允许的地址（您的前端域名）
    const productionOrigins = [
      'https://your-frontend.vercel.app', // 如果将来部署前端
      // 可以添加更多生产域名
    ];
    
    const allowedOrigins = [...developmentOrigins, ...productionOrigins];
    
    // 在开发环境中更宽松，允许所有localhost和本地IP
    if (process.env.NODE_ENV === 'development' || !origin) {
      return callback(null, true);
    }
    
    // 检查origin是否在允许列表中
    if (allowedOrigins.includes(origin) || origin?.match(/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):\d+$/)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // 在API服务中，我们可以更宽松一些
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-File-Name'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

// 使用CORS中间件
app.use(cors(corsOptions));

// 基础中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 添加安全头部
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // API服务允许所有域名
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Accept, Origin, Cache-Control, X-File-Name');
  next();
});

// 请求日志
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin}`);
  next();
});

// 环境变量检查
const TRIPO_API_KEY = process.env.TRIPO_API_KEY;
const MESHY_API_KEY = process.env.MESHY_API_KEY;

if (!TRIPO_API_KEY) {
  console.error('⚠️  缺少环境变量 TRIPO_API_KEY');
}
if (!MESHY_API_KEY) {
  console.error('⚠️  缺少环境变量 MESHY_API_KEY');
}

// API文档首页
app.get('/', (req, res) => {
  res.json({
    name: 'Vue 3D Model API Service',
    status: 'running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    platform: isVercel ? 'Vercel' : 'Local',
    timestamp: new Date().toISOString(),
    description: '3D模型生成和骨骼绑定API服务',
    usage: {
      frontend_development: {
        base_url: isVercel ? 'https://your-api.vercel.app' : 'http://localhost:3000',
        note: '在前端项目中使用此base_url调用API'
      }
    },
    endpoints: {
      tripo: {
        base: '/api/tripo',
        routes: [
          { path: '/', method: 'GET', desc: 'Tripo API状态' },
          { path: '/upload/sts', method: 'POST', desc: '上传图片到STS' },
          { path: '/create-task', method: 'POST', desc: '创建模型生成任务' },
          { path: '/multiview-to-model-with-tokens', method: 'POST', desc: '多视角转3D模型' },
          { path: '/status/:taskId', method: 'GET', desc: '查询任务状态' },
          { path: '/generate-texture', method: 'POST', desc: '生成纹理' },
          { path: '/proxy-model', method: 'GET', desc: '模型文件代理' }
        ]
      },
      meshy: {
        base: '/api/meshy',
        routes: [
          { path: '/', method: 'GET', desc: 'Meshy API状态' },
          { path: '/rig', method: 'POST', desc: '骨骼绑定' },
          { path: '/rig/status/:taskId', method: 'GET', desc: '查询绑定状态' }
        ]
      }
    }
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    platform: isVercel ? 'Vercel' : 'Local',
    apis: {
      tripo: !!TRIPO_API_KEY,
      meshy: !!MESHY_API_KEY
    }
  });
});

// API路由
app.use('/api/tripo', tripoRouter);
app.use('/api/meshy', meshyRouter);

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    error: '未找到请求的资源',
    path: req.path,
    method: req.method,
    available_endpoints: ['/api/tripo', '/api/meshy', '/health']
  });
});

// 错误处理
app.use((error, req, res, next) => {
  console.error('API错误:', error);
  res.status(error.status || 500).json({
    error: error.message || '内部服务器错误',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Vercel 导出
module.exports = app;

// 本地开发启动
if (!isVercel) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 API服务已启动: http://localhost:${PORT}`);
    console.log(`📖 API文档: http://localhost:${PORT}`);
    console.log(`🔧 环境: ${process.env.NODE_ENV || 'development'}`);
  });
}
