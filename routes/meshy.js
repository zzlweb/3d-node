const express = require('express');
const router = express.Router();
const axios = require('axios');

const MESHY_BASE_URL = 'https://api.meshy.ai';
const MESHY_API_KEY = process.env.MESHY_API_KEY;

// 骨骼绑定
router.post('/rig', async (req, res, next) => {
  try {
    const { model_url, height_meters = 1.8 } = req.body;
    
    console.log('创建骨骼绑定任务:', {
      model_url,
      height_meters
    });

    const payload = {
      model_url: model_url,
      height_meters: height_meters
    };

    const response = await axios.post(`${MESHY_BASE_URL}/openapi/v1/rigging`, payload, {
      headers: {
        'Authorization': `Bearer ${MESHY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Meshy API 骨骼绑定响应:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('骨骼绑定错误:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message,
      details: error.response?.data || null
    });
  }
});

// 绑定状态查询（保留作为备用）
router.get('/rig/status/:taskId', async (req, res, next) => {
  try {
    const response = await axios.get(`${MESHY_BASE_URL}/openapi/v1/rigging/${req.params.taskId}`, {
      headers: {
        'Authorization': `Bearer ${MESHY_API_KEY}`
      }
    });
    
    console.log('Meshy API 状态查询响应:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('状态查询错误:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || error.message,
      details: error.response?.data || null
    });
  }
});

// 新增：流式获取绑定状态
router.get('/rig/stream/:taskId', async (req, res) => {
  const taskId = req.params.taskId;
  
  console.log('开始流式监听绑定状态:', taskId);
  
  // 设置 SSE 响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  try {
    // 创建到 Meshy API 的流式连接
    const response = await axios({
      method: 'GET',
      url: `${MESHY_BASE_URL}/openapi/v1/rigging/${taskId}/stream`,
      headers: {
        'Authorization': `Bearer ${MESHY_API_KEY}`,
        'Accept': 'text/event-stream'
      },
      responseType: 'stream'
    });

    // 将 Meshy API 的流数据转发给前端
    response.data.on('data', (chunk) => {
      const data = chunk.toString();
      console.log('收到流数据:', data);
      res.write(data);
    });

    response.data.on('end', () => {
      console.log('流结束');
      res.end();
    });

    response.data.on('error', (error) => {
      console.error('流错误:', error);
      res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('创建流连接失败:', error.response?.data || error.message);
    res.write(`event: error\ndata: ${JSON.stringify({ 
      error: error.response?.data?.error || error.message 
    })}\n\n`);
    res.end();
  }

  // 处理客户端断开连接
  req.on('close', () => {
    console.log('客户端断开流连接:', taskId);
  });
});

module.exports = router; 