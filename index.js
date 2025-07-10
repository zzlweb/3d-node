require('dotenv').config();
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

// Railway环境检测
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;

// 详细的CORS配置
const corsOptions = {
  origin: function (origin, callback) {
    // 允许的域名列表
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173', // Vite 开发服务器
      'http://localhost:4173', // Vite 预览服务器
      'https://your-frontend-domain.com', // 替换为您的前端域名
      // Railway提供的域名格式
      /^https:\/\/.*\.railway\.app$/,
      /^https:\/\/.*\.up\.railway\.app$/
    ];
    
    // 在开发环境或Railway环境允许所有域名
    if (process.env.NODE_ENV === 'development' || isRailway) {
      callback(null, true);
    } else if (!origin || allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') return allowed === origin;
      if (allowed instanceof RegExp) return allowed.test(origin);
      return false;
    })) {
      callback(null, true);
    } else {
      callback(new Error('不被CORS策略允许'));
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

// 手动处理预检请求
app.options('*', cors(corsOptions));

// 基础中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 添加安全头部
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  
  // Railway特定的头部处理
  if (isRailway) {
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  next();
});

// 添加请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.files || req.file) {
    console.log('文件上传请求:', {
      files: req.files?.length || 0,
      file: req.file?.originalname || 'none'
    });
  }
  next();
});

// 确保上传文件夹存在
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 环境变量检查
const TRIPO_API_KEY = process.env.TRIPO_API_KEY;
const MESHY_API_KEY = process.env.MESHY_API_KEY;

if (!TRIPO_API_KEY) {
  console.error('缺少环境变量 TRIPO_API_KEY');
  if (!isRailway) process.exit(1);
}
if (!MESHY_API_KEY) {
  console.error('缺少环境变量 MESHY_API_KEY');
  if (!isRailway) process.exit(1);
}

// 在路由之前添加请求验证中间件
app.use('/api', (req, res, next) => {
  // 记录请求详情
  console.log('API请求:', {
    method: req.method,
    path: req.path,
    params: req.params,
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined,
    headers: {
      'content-type': req.headers['content-type'],
      'authorization': req.headers.authorization ? '***' : undefined
    }
  });
  
  // 验证API密钥是否配置
  if (req.path.startsWith('/tripo') && !TRIPO_API_KEY) {
    return res.status(500).json({
      error: 'TRIPO_API_KEY 未配置'
    });
  }
  
  if (req.path.startsWith('/meshy') && !MESHY_API_KEY) {
    return res.status(500).json({
      error: 'MESHY_API_KEY 未配置'
    });
  }
  
  next();
});

// 默认路由
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: '3D模型生成服务API',
    version: '1.0.0',
    platform: isRailway ? 'Railway' : 'Local',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      tripo: '/api/tripo',
      meshy: '/api/meshy'
    }
  });
});

// 健康检查 - Railway需要
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: process.memoryUsage(),
    platform: isRailway ? 'Railway' : 'Local',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API 路由
app.use('/api/tripo', tripoRouter);
app.use('/api/meshy', meshyRouter);

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    error: '未找到请求的资源',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// 错误处理中间件
app.use(errorHandler);

// Railway端口配置
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 服务已启动: http://${HOST}:${PORT}`);
  console.log(`📋 API文档: http://${HOST}:${PORT}/`);
  console.log(`❤️  健康检查: http://${HOST}:${PORT}/health`);
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚂 平台: ${isRailway ? 'Railway' : 'Local'}`);
  
  if (isRailway) {
    console.log(`🔗 Railway URL: ${process.env.RAILWAY_STATIC_URL || 'https://your-app.up.railway.app'}`);
  }
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在优雅关闭...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在优雅关闭...');
  process.exit(0);
});
