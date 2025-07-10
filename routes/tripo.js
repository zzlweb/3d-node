const express = require('express');
const router = express.Router();
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');
// 配置 multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 确保上传目录存在
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads', { recursive: true });
    }
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    // 生成唯一文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 只接受图片文件
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('只支持上传图片文件！'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 限制 5MB
    files: 1 // 一次只允许上传一个文件
  }
});

const TRIPO_BASE_URL = 'https://api.tripo3d.ai/v2/openapi';
const TRIPO_API_KEY = process.env.TRIPO_API_KEY;

// 测试文件上传路由
router.post('/test-upload', upload.single('file'), (req, res) => {
  console.log('测试上传接收到的请求');
  console.log('Headers:', req.headers);
  console.log('File info:', req.file);
  
  if (!req.file) {
    return res.status(400).json({ 
      error: '没有接收到文件',
      headers: req.headers,
      body: req.body
    });
  }
  
  res.json({
    success: true,
    message: '文件上传测试成功',
    file: {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    }
  });
  
  // 清理测试文件
  setTimeout(() => {
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }, 1000);
});

// 文本转模型
router.post('/text-to-model', async (req, res, next) => {
  try {
    const requestData = {
      type: "text_to_model",
      prompt: req.body.prompt,
      ...req.body.options
    };
    const response = await axios.post(`${TRIPO_BASE_URL}/task`, requestData, {
      headers: {
        'Authorization': `Bearer ${TRIPO_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    next(error);
  }
});


// 创建模型生成任务（使用 file_token）
router.post('/create-task', async (req, res, next) => {
  try {
    const { type, file, ...options } = req.body;

    // 验证必需参数
    if (!type) {
      return res.status(400).json({ error: '缺少 type 参数' });
    }

    if (!file || !file.file_token || !file.type) {
      return res.status(400).json({ 
        error: '缺少 file 参数或 file.file_token/file.type' 
      });
    }

    console.log('创建任务请求:', {
      type,
      file,
      options
    });

    const requestData = {
      type: type,
      file: {
        type: file.type,
        file_token: file.file_token
      },
      ...options
    };

    const response = await axios.post(`${TRIPO_BASE_URL}/task`, requestData, {
      headers: {
        'Authorization': `Bearer ${TRIPO_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Tripo API 创建任务响应:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('创建任务错误:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message,
      details: error.response?.data || null
    });
  }
});

// 多图转模型
router.post('/multiview-to-model', upload.array('images', 6), async (req, res, next) => {
  try {
    const formData = new FormData();
    formData.append('type', 'multiview_to_model');
    req.files.forEach(file => {
      formData.append('images', fs.createReadStream(file.path));
    });
    if (req.body.prompt) formData.append('prompt', req.body.prompt);

    const response = await axios.post(`${TRIPO_BASE_URL}/task`, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${TRIPO_API_KEY}`
      }
    });

    req.files.forEach(file => fs.unlinkSync(file.path));
    res.json(response.data);
  } catch (error) {
    req.files?.forEach(file => fs.unlinkSync(file.path));
    next(error);
  }
});

// 使用 file_tokens 的多视角转模型
router.post('/multiview-to-model-with-tokens', async (req, res, next) => {
  try {
    const { type, files, ...options } = req.body;

    // 验证必需参数
    if (!type || type !== 'multiview_to_model') {
      return res.status(400).json({ error: '类型必须是 multiview_to_model' });
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ 
        error: '缺少 files 参数或 files 不是数组' 
      });
    }

    // 验证每个文件是否有必需的字段
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.file_token || !file.type) {
        return res.status(400).json({ 
          error: `文件 ${i} 缺少 file_token 或 type` 
        });
      }
    }

    console.log('创建多视角任务请求:', {
      type,
      files,
      options
    });

    const requestData = {
      type: type,
      files: files,
      ...options
    };

    const response = await axios.post(`${TRIPO_BASE_URL}/task`, requestData, {
      headers: {
        'Authorization': `Bearer ${TRIPO_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Tripo API 多视角任务创建响应:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('创建多视角任务错误:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message,
      details: error.response?.data || null
    });
  }
});

// 查询任务状态
router.get('/status/:taskId', async (req, res, next) => {
  try {
    const response = await axios.get(`${TRIPO_BASE_URL}/task/${req.params.taskId}`, {
      headers: {
        'Authorization': `Bearer ${TRIPO_API_KEY}`
      }
    });
    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

// 获取任务列表
router.get('/task', async (req, res, next) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const response = await axios.get(`${TRIPO_BASE_URL}/task`, {
      headers: {
        'Authorization': `Bearer ${TRIPO_API_KEY}`
      },
      params: { limit, offset }
    });
    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

// 取消任务
router.delete('/task/:taskId', async (req, res, next) => {
  try {
    const response = await axios.delete(`${TRIPO_BASE_URL}/task/${req.params.taskId}`, {
      headers: {
        'Authorization': `Bearer ${TRIPO_API_KEY}`
      }
    });
    res.json(response.data);
  } catch (error) {
    next(error);
  }
});

// 图片上传到 STS
router.post('/upload/sts', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    try {
      // 处理 multer 错误
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: '文件大小超过限制（最大5MB）' });
        }
        return res.status(400).json({ error: err.message });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }

      // 检查是否有文件上传
      if (!req.file) {
        return res.status(400).json({ error: '没有上传文件' });
      }

      console.log('文件上传成功到临时目录:', {
        path: req.file.path,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      // 读取文件内容
      const fileBuffer = fs.readFileSync(req.file.path);
      
      const formData = new FormData();
      formData.append('file', fileBuffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
        knownLength: fileBuffer.length
      });

      // 上传到 Tripo STS
      const response = await axios.post('https://api.tripo3d.ai/v2/openapi/upload/sts', formData, {
        headers: {
          'Authorization': `Bearer ${TRIPO_API_KEY}`,
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      console.log('STS上传响应:', response.data);

      // 清理临时文件
      // fs.unlinkSync(req.file.path);
      res.json(response.data);
    } catch (error) {
      console.error('STS上传错误:', error.response?.data || error.message);
      
      // 清理临时文件
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.error('清理临时文件失败:', e);
        }
      }
      
      // 返回详细的错误信息
      res.status(error.response?.status || 500).json({
        error: error.response?.data?.error || error.message,
        details: error.response?.data || null
      });
    }
  });
});

// 纹理生成
router.post('/generate-texture', async (req, res, next) => {
  try {
    const { type, original_model_task_id, ...options } = req.body;

    // 验证必需参数
    if (!type || type !== 'texture_model') {
      return res.status(400).json({ error: '类型必须是 texture_model' });
    }

    if (!original_model_task_id) {
      return res.status(400).json({ 
        error: '缺少 original_model_task_id 参数' 
      });
    }

    console.log('创建纹理生成任务请求:', {
      type,
      original_model_task_id,
      options
    });

    const requestData = {
      type: type,
      original_model_task_id: original_model_task_id,
      ...options
    };

    const response = await axios.post(`${TRIPO_BASE_URL}/task`, requestData, {
      headers: {
        'Authorization': `Bearer ${TRIPO_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Tripo API 纹理任务创建响应:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('创建纹理任务错误:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message,
      details: error.response?.data || null
    });
  }
});

module.exports = router; 